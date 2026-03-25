const test = require("node:test");
const assert = require("node:assert/strict");

function requireFresh(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test("parseReminderHandlerRegistrations trims values and returns registrations", () => {
  const { parseReminderHandlerRegistrations } = requireFresh(
    "../dist/src/functions/sendOverdueReminderEmails/createReminderHandler.js",
  );

  const registrations = parseReminderHandlerRegistrations({
    sendOverdueReminderEmails: {
      subjectTemplate: "  Reminder for {InvoiceNumber}  ",
      emailBodyTemplate: "  Hello {ClientName}  ",
      filter: "  Status eq 'Overdue'  ",
    },
  });

  assert.deepEqual(registrations, [
    {
      functionName: "sendOverdueReminderEmails",
      definition: {
        subjectTemplate: "Reminder for {InvoiceNumber}",
        emailBodyTemplate: "Hello {ClientName}",
        filter: "Status eq 'Overdue'",
      },
    },
  ]);
});

test("parseReminderHandlerRegistrations rejects invalid config", () => {
  const { parseReminderHandlerRegistrations } = requireFresh(
    "../dist/src/functions/sendOverdueReminderEmails/createReminderHandler.js",
  );

  assert.throws(
    () => parseReminderHandlerRegistrations([]),
    /config file must be a JSON object/i,
  );
  assert.throws(
    () =>
      parseReminderHandlerRegistrations({
        sendOverdueReminderEmails: {
          subjectTemplate: "Subject",
          emailBodyTemplate: "Body",
        },
      }),
    /missing filter/i,
  );
});

test("createReminderHandler returns workflow result in a 200 response", async () => {
  process.env.SHAREPOINT_SITE_ID = "site-123";
  process.env.SHAREPOINT_LIST_ID = "list-456";
  process.env.SHARED_MAILBOX = "billing@example.test";
  process.env.GRAPH_TENANT_ID = "tenant-1";
  process.env.GRAPH_CLIENT_ID = "client-1";
  process.env.GRAPH_CLIENT_SECRET = "secret-1";
  process.env.GRAPH_SCOPE = "scope/.default";

  const tokenModule = requireFresh("../dist/src/tools/getGraphAccessToken.js");
  const sharepointModule = requireFresh(
    "../dist/src/clients/sharepointClient.js",
  );
  const emailModule = requireFresh("../dist/src/clients/emailClient.js");
  const workflowModule = requireFresh(
    "../dist/src/functions/sendOverdueReminderEmails/runOverdueReminderEmailsWorkflow.js",
  );
  const { createReminderHandler } = requireFresh(
    "../dist/src/functions/sendOverdueReminderEmails/createReminderHandler.js",
  );

  const capturedCalls = [];
  const originalGetGraphAccessToken = tokenModule.getGraphAccessToken;
  const originalGetSharePointListItems = sharepointModule.getSharePointListItems;
  const originalSendEmail = emailModule.sendEmail;
  const originalRunWorkflow =
    workflowModule.runOverdueReminderEmailsWorkflow;

  tokenModule.getGraphAccessToken = async (config) => {
    capturedCalls.push({ kind: "token", config });
    return "graph-token";
  };
  sharepointModule.getSharePointListItems = async (...args) => {
    capturedCalls.push({ kind: "sharepoint", args });
    return [];
  };
  emailModule.sendEmail = async (args) => {
    capturedCalls.push({ kind: "email", args });
    return { isError: false, statusCode: 202 };
  };
  workflowModule.runOverdueReminderEmailsWorkflow = async (deps, input) => {
    const token = await deps.getGraphAccessToken();
    await deps.getSharePointListItems(token, input.filter, input.siteId, input.listId);
    await deps.sendEmail({
      graphAccessToken: token,
      senderMailbox: input.senderMailbox,
      recipientEmail: "accounts@example.test",
      subject: input.subjectTemplate,
      bodyText: input.emailBodyTemplate,
    });

    return {
      status: "completed",
      message: "Workflow completed.",
      matchedCount: 1,
      sentCount: 1,
      skippedCount: 0,
      failedCount: 0,
      siteId: input.siteId,
      listId: input.listId,
      senderMailbox: input.senderMailbox,
      filter: input.filter,
    };
  };

  try {
    const logCalls = [];
    const errorCalls = [];
    const handler = createReminderHandler("sendOverdueReminderEmails", {
      subjectTemplate: "Reminder",
      emailBodyTemplate: "Body",
      filter: "Status eq 'Overdue'",
    });

    const response = await handler(
      {},
      {
        log: (...args) => logCalls.push(args),
        error: (...args) => errorCalls.push(args),
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.jsonBody, {
      ok: true,
      result: {
        status: "completed",
        message: "Workflow completed.",
        matchedCount: 1,
        sentCount: 1,
        skippedCount: 0,
        failedCount: 0,
        siteId: "site-123",
        listId: "list-456",
        senderMailbox: "billing@example.test",
        filter: "Status eq 'Overdue'",
      },
    });
    assert.equal(errorCalls.length, 0);
    assert.deepEqual(capturedCalls, [
      {
        kind: "token",
        config: {
          tenantId: "tenant-1",
          clientId: "client-1",
          clientSecret: "secret-1",
          scope: "scope/.default",
        },
      },
      {
        kind: "sharepoint",
        args: ["graph-token", "Status eq 'Overdue'", "site-123", "list-456"],
      },
      {
        kind: "email",
        args: {
          graphAccessToken: "graph-token",
          senderMailbox: "billing@example.test",
          recipientEmail: "accounts@example.test",
          subject: "Reminder",
          bodyText: "Body",
        },
      },
    ]);
    assert.match(logCalls[0][0], /Reminder handler invoked/);
  } finally {
    tokenModule.getGraphAccessToken = originalGetGraphAccessToken;
    sharepointModule.getSharePointListItems = originalGetSharePointListItems;
    emailModule.sendEmail = originalSendEmail;
    workflowModule.runOverdueReminderEmailsWorkflow = originalRunWorkflow;
    delete process.env.SHAREPOINT_SITE_ID;
    delete process.env.SHAREPOINT_LIST_ID;
    delete process.env.SHARED_MAILBOX;
    delete process.env.GRAPH_TENANT_ID;
    delete process.env.GRAPH_CLIENT_ID;
    delete process.env.GRAPH_CLIENT_SECRET;
    delete process.env.GRAPH_SCOPE;
  }
});

test("createReminderHandler returns 500 when required settings are missing", async () => {
  delete process.env.SHAREPOINT_SITE_ID;
  process.env.SHAREPOINT_LIST_ID = "list-456";
  process.env.SHARED_MAILBOX = "billing@example.test";

  const { createReminderHandler } = requireFresh(
    "../dist/src/functions/sendOverdueReminderEmails/createReminderHandler.js",
  );

  const errorCalls = [];
  const handler = createReminderHandler("sendOverdueReminderEmails", {
    subjectTemplate: "Reminder",
    emailBodyTemplate: "Body",
    filter: "Status eq 'Overdue'",
  });

  const response = await handler(
    {},
    {
      log: () => {},
      error: (...args) => errorCalls.push(args),
    },
  );

  assert.equal(response.status, 500);
  assert.deepEqual(response.jsonBody, {
    ok: false,
    error: "Missing required application setting: SHAREPOINT_SITE_ID",
  });
  assert.equal(errorCalls.length, 1);

  delete process.env.SHAREPOINT_LIST_ID;
  delete process.env.SHARED_MAILBOX;
});

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  runOverdueReminderEmailsWorkflow,
} = require("../dist/src/functions/sendOverdueReminderEmails/runOverdueReminderEmailsWorkflow.js");

function createBaseInput() {
  return {
    siteId: "site-1",
    listId: "list-1",
    senderMailbox: "billing@demo.test",
    filter: "Status eq 'Overdue'",
    subjectTemplate: "Reminder: invoice {InvoiceNumber} for {ClientName}",
    emailBodyTemplate:
      "Hi {ClientName}, invoice {InvoiceNumber} was due on {DueDate}.",
  };
}

test("returns completed and sends one reminder for one valid invoice", async () => {
  let tokenCallCount = 0;
  const listCalls = [];
  const sendCalls = [];

  const result = await runOverdueReminderEmailsWorkflow(
    {
      getGraphAccessToken: async () => {
        tokenCallCount += 1;
        return "fake-token";
      },
      getSharePointListItems: async (...args) => {
        listCalls.push(args);
        return [
          {
            Id: "42",
            ClientName: "Acme Pty Ltd",
            ClientEmail: "accounts@acme.test",
            InvoiceNumber: "INV-1001",
            DueDate: "2026-03-01",
          },
        ];
      },
      sendEmail: async (args) => {
        sendCalls.push(args);
        return {
          isError: false,
          statusCode: 202,
        };
      },
      log: () => {},
    },
    createBaseInput(),
  );

  assert.equal(tokenCallCount, 1);
  assert.deepEqual(listCalls, [
    ["fake-token", "Status eq 'Overdue'", "site-1", "list-1"],
  ]);
  assert.equal(sendCalls.length, 1);
  assert.deepEqual(sendCalls[0], {
    graphAccessToken: "fake-token",
    senderMailbox: "billing@demo.test",
    recipientEmail: "accounts@acme.test",
    subject: "Reminder: invoice INV-1001 for Acme Pty Ltd",
    bodyText: "Hi Acme Pty Ltd, invoice INV-1001 was due on 2026-03-01.",
  });
  assert.equal(result.status, "completed");
  assert.equal(result.matchedCount, 1);
  assert.equal(result.sentCount, 1);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.failedCount, 0);
});

test("skips invoice when ClientEmail is missing", async () => {
  const sendCalls = [];

  const result = await runOverdueReminderEmailsWorkflow(
    {
      getGraphAccessToken: async () => "fake-token",
      getSharePointListItems: async () => [
        {
          Id: "42",
          ClientName: "Acme Pty Ltd",
          InvoiceNumber: "INV-1001",
          DueDate: "2026-03-01",
        },
      ],
      sendEmail: async (args) => {
        sendCalls.push(args);
        return {
          isError: false,
          statusCode: 202,
        };
      },
      log: () => {},
    },
    createBaseInput(),
  );

  assert.equal(sendCalls.length, 0);
  assert.equal(result.status, "completed");
  assert.equal(result.matchedCount, 1);
  assert.equal(result.sentCount, 0);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.failedCount, 0);
});

test(
  "returns completed_with_failures when one send fails but processing continues",
  async () => {
    const sendCalls = [];

    const result = await runOverdueReminderEmailsWorkflow(
      {
        getGraphAccessToken: async () => "fake-token",
        getSharePointListItems: async () => [
          {
            Id: "1",
            ClientName: "Acme Pty Ltd",
            ClientEmail: "accounts@acme.test",
            InvoiceNumber: "INV-1001",
            DueDate: "2026-03-01",
          },
          {
            Id: "2",
            ClientName: "Beta Pty Ltd",
            ClientEmail: "finance@beta.test",
            InvoiceNumber: "INV-1002",
            DueDate: "2026-03-02",
          },
        ],
        sendEmail: async (args) => {
          sendCalls.push(args);

          if (sendCalls.length === 1) {
            return {
              isError: true,
              statusCode: 500,
              errorMessage: "Graph send failed",
              errorCode: "internalError",
            };
          }

          return {
            isError: false,
            statusCode: 202,
          };
        },
        log: () => {},
      },
      createBaseInput(),
    );

    assert.equal(sendCalls.length, 2);
    assert.equal(result.status, "completed_with_failures");
    assert.equal(result.matchedCount, 2);
    assert.equal(result.sentCount, 1);
    assert.equal(result.skippedCount, 0);
    assert.equal(result.failedCount, 1);
  },
);

test("uses fallback template values when invoice fields are missing", async () => {
  const sendCalls = [];

  const result = await runOverdueReminderEmailsWorkflow(
    {
      getGraphAccessToken: async () => "fake-token",
      getSharePointListItems: async () => [
        {
          Id: "42",
          ClientEmail: "accounts@acme.test",
        },
      ],
      sendEmail: async (args) => {
        sendCalls.push(args);
        return {
          isError: false,
          statusCode: 202,
        };
      },
      log: () => {},
    },
    createBaseInput(),
  );

  assert.deepEqual(sendCalls[0], {
    graphAccessToken: "fake-token",
    senderMailbox: "billing@demo.test",
    recipientEmail: "accounts@acme.test",
    subject: "Reminder: invoice 42 for customer",
    bodyText: "Hi customer, invoice 42 was due on the recorded due date.",
  });
  assert.equal(result.status, "completed");
});

test("counts thrown sendEmail errors as failures and keeps processing", async () => {
  const attemptedRecipients = [];

  const result = await runOverdueReminderEmailsWorkflow(
    {
      getGraphAccessToken: async () => "fake-token",
      getSharePointListItems: async () => [
        {
          Id: "1",
          ClientName: "Acme Pty Ltd",
          ClientEmail: "accounts@acme.test",
          InvoiceNumber: "INV-1001",
          DueDate: "2026-03-01",
        },
        {
          Id: "2",
          ClientName: "Beta Pty Ltd",
          ClientEmail: "finance@beta.test",
          InvoiceNumber: "INV-1002",
          DueDate: "2026-03-02",
        },
      ],
      sendEmail: async (args) => {
        attemptedRecipients.push(args.recipientEmail);

        if (args.recipientEmail === "accounts@acme.test") {
          throw new Error("Socket hang up");
        }

        return {
          isError: false,
          statusCode: 202,
        };
      },
      log: () => {},
    },
    createBaseInput(),
  );

  assert.deepEqual(attemptedRecipients, [
    "accounts@acme.test",
    "finance@beta.test",
  ]);
  assert.equal(result.status, "completed_with_failures");
  assert.equal(result.sentCount, 1);
  assert.equal(result.failedCount, 1);
});

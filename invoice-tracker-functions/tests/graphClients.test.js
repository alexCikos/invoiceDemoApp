const test = require("node:test");
const assert = require("node:assert/strict");

function requireFresh(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test("getGraphAccessToken returns access token from Graph response", async () => {
  const axios = require("axios");
  const originalPost = axios.post;
  axios.post = async (url, body, config) => {
    assert.match(url, /oauth2\/v2\.0\/token$/);
    assert.match(body, /grant_type=client_credentials/);
    assert.equal(
      config.headers["Content-Type"],
      "application/x-www-form-urlencoded",
    );
    return {
      data: {
        access_token: "token-123",
      },
    };
  };

  try {
    const { getGraphAccessToken } = requireFresh(
      "../dist/src/tools/getGraphAccessToken.js",
    );

    const token = await getGraphAccessToken({
      tenantId: "tenant-1",
      clientId: "client-1",
      clientSecret: "secret-1",
    });

    assert.equal(token, "token-123");
  } finally {
    axios.post = originalPost;
  }
});

test("getGraphAccessToken surfaces Graph API failures clearly", async () => {
  const axios = require("axios");
  const originalPost = axios.post;
  const originalIsAxiosError = axios.isAxiosError;
  const error = new Error("Request failed with status code 401");
  error.response = {
    status: 401,
    data: {
      error: "invalid_client",
      error_description: "Client authentication failed.",
    },
  };

  axios.post = async () => {
    throw error;
  };
  axios.isAxiosError = (value) => value === error;

  try {
    const { getGraphAccessToken } = requireFresh(
      "../dist/src/tools/getGraphAccessToken.js",
    );

    await assert.rejects(
      () =>
        getGraphAccessToken({
          tenantId: "tenant-1",
          clientId: "client-1",
          clientSecret: "secret-1",
        }),
      /Graph token request failed \(401\) invalid_client Client authentication failed\./,
    );
  } finally {
    axios.post = originalPost;
    axios.isAxiosError = originalIsAxiosError;
  }
});

test("getSharePointListItems maps returned fields", async () => {
  const axios = require("axios");
  const originalGet = axios.get;
  axios.get = async (url, config) => {
    assert.match(url, /%24expand=fields/);
    assert.match(url, /%24filter=Status\+eq\+%27Overdue%27/);
    assert.equal(config.headers.Authorization, "Bearer token-123");
    return {
      data: {
        value: [
          {
            fields: {
              LinkTitle: "INV-1001",
              field_1: "Acme Pty Ltd",
              field_2: "accounts@acme.test",
            },
          },
        ],
      },
    };
  };

  try {
    const { getSharePointListItems } = requireFresh(
      "../dist/src/clients/sharepointClient.js",
    );

    const items = await getSharePointListItems(
      "token-123",
      "Status eq 'Overdue'",
      "site-1",
      "list-1",
    );

    assert.deepEqual(items, [
      {
        InvoiceNumber: "INV-1001",
        ClientName: "Acme Pty Ltd",
        ClientEmail: "accounts@acme.test",
        ProjectName: undefined,
        InvoiceDate: undefined,
        DueDate: undefined,
        Currency: undefined,
        Subtotal: undefined,
        TaxRate: undefined,
        TaxAmount: undefined,
        TotalAmount: undefined,
        AmountPaid: undefined,
        Balance: undefined,
        Status: undefined,
        PaymentTerms: undefined,
        PaymentMethod: undefined,
        PurchaseOrderNumber: undefined,
        SentDate: undefined,
        PaidDate: undefined,
        LastReminderDate: undefined,
        Owner: undefined,
        Notes: undefined,
        ReminderEnabled: undefined,
        DoNotContact: undefined,
        ReminderPausedUntil: undefined,
        ReminderFrequencyDays: undefined,
        NextReminderDate: undefined,
        EscalationEnabled: undefined,
        EscalationThresholdDays: undefined,
        CollectionPriority: undefined,
        Id: undefined,
        Created: undefined,
        Modified: undefined,
      },
    ]);
  } finally {
    axios.get = originalGet;
  }
});

test("sendEmail retries retryable DNS failures and succeeds", async () => {
  const axios = require("axios");
  const originalPost = axios.post;
  const originalIsAxiosError = axios.isAxiosError;
  const originalSetTimeout = global.setTimeout;
  let postCallCount = 0;
  const retryableError = new Error("getaddrinfo EAI_AGAIN graph.microsoft.com");
  retryableError.code = "EAI_AGAIN";

  axios.post = async () => {
    postCallCount += 1;
    if (postCallCount === 1) {
      throw retryableError;
    }

    return { status: 202 };
  };
  axios.isAxiosError = (value) => value === retryableError;
  global.setTimeout = (callback) => {
    callback();
    return 0;
  };

  try {
    const { sendEmail } = requireFresh("../dist/src/clients/emailClient.js");

    const result = await sendEmail({
      graphAccessToken: "token-123",
      senderMailbox: "billing@example.test",
      recipientEmail: "accounts@acme.test",
      subject: "Reminder",
      bodyText: "Body",
    });

    assert.deepEqual(result, {
      isError: false,
      statusCode: 202,
    });
    assert.equal(postCallCount, 2);
  } finally {
    axios.post = originalPost;
    axios.isAxiosError = originalIsAxiosError;
    global.setTimeout = originalSetTimeout;
  }
});

test("sendEmail returns structured Graph errors for HTTP failures", async () => {
  const axios = require("axios");
  const originalPost = axios.post;
  const originalIsAxiosError = axios.isAxiosError;
  const error = new Error("Request failed with status code 403");
  error.response = {
    status: 403,
    data: {
      error: {
        code: "ErrorAccessDenied",
        message: "Access is denied.",
      },
    },
  };

  axios.post = async () => {
    throw error;
  };
  axios.isAxiosError = (value) => value === error;

  try {
    const { sendEmail } = requireFresh("../dist/src/clients/emailClient.js");

    const result = await sendEmail({
      graphAccessToken: "token-123",
      senderMailbox: "billing@example.test",
      recipientEmail: "accounts@acme.test",
      subject: "Reminder",
      bodyText: "Body",
    });

    assert.deepEqual(result, {
      isError: true,
      statusCode: 403,
      errorMessage: "Access is denied.",
      errorCode: "ErrorAccessDenied",
    });
  } finally {
    axios.post = originalPost;
    axios.isAxiosError = originalIsAxiosError;
  }
});

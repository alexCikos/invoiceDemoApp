import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getGraphAccessToken } from "../tools/getGraphAccessToken";
import { sendEmail } from "../tools/sendEmail";

const TEST_RECIPIENT_EMAIL = "cikosalex@gmail.com";
const DEFAULT_SUBJECT = "Invoice Tracker: test email";
const DEFAULT_MESSAGE =
  "This is a test email from the Invoice Tracker function app.";
const DEFAULT_SENDER_MAILBOX =
  process.env.SHARED_MAILBOX ??
  "automationsprod@cikosAutomation.onmicrosoft.com";

type SendTestEmailBody = {
  subject?: unknown;
  message?: unknown;
};

function normalizeOptionalString(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

async function readBody(
  request: HttpRequest,
): Promise<{ subject: string; message: string }> {
  const rawBody = (await request.text()).trim();
  if (!rawBody) {
    return { subject: DEFAULT_SUBJECT, message: DEFAULT_MESSAGE };
  }

  const parsed = JSON.parse(rawBody) as SendTestEmailBody;
  const subject = normalizeOptionalString(parsed.subject) ?? DEFAULT_SUBJECT;
  const message = normalizeOptionalString(parsed.message) ?? DEFAULT_MESSAGE;

  return { subject, message };
}

export async function sendTestEmail(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const senderMailbox =
    process.env.REMINDER_SENDER_MAILBOX ?? DEFAULT_SENDER_MAILBOX;

  let subject: string;
  let message: string;

  try {
    const body = await readBody(request);
    subject = body.subject;
    message = body.message;
  } catch {
    return {
      status: 400,
      jsonBody: {
        ok: false,
        error:
          "Request body must be valid JSON. Optional properties: subject, message.",
      },
    };
  }

  try {
    const graphAccessToken = await getGraphAccessToken();

    await sendEmail({
      graphAccessToken,
      senderMailbox,
      recipientEmail: TEST_RECIPIENT_EMAIL,
      subject,
      bodyText: message,
    });

    context.log("Test email sent", {
      invocationId: context.invocationId,
      senderMailbox,
      recipientEmail: TEST_RECIPIENT_EMAIL,
    });

    return {
      status: 200,
      jsonBody: {
        ok: true,
        senderMailbox,
        recipientEmail: TEST_RECIPIENT_EMAIL,
        subject,
      },
    };
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);

    context.error("Failed to send test email", {
      invocationId: context.invocationId,
      senderMailbox,
      recipientEmail: TEST_RECIPIENT_EMAIL,
      details,
    });

    return {
      status: 502,
      jsonBody: {
        ok: false,
        error: "Unable to send test email via Microsoft Graph.",
        details,
      },
    };
  }
}

app.http("send-test-email", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: sendTestEmail,
});

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getGraphAccessToken } from "../tools/getGraphAccessToken";
import {
  getSharePointListItems,
  OVERDUE_INVOICE_FILTER,
} from "./invoiceReminder/getSharePointListItems";

// HTTP handler should stay thin: orchestrate calls and shape responses only.
export async function overdueInvoiceReminder(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    // Shared auth helper: keeps token logic out of business-specific handlers.
    const graphAccessToken = await getGraphAccessToken();
    // Business logic lives in a separate module for easier testing and reuse.
    const fields = await getSharePointListItems(graphAccessToken);

    context.log("Overdue invoice reminder filter query succeeded", {
      invocationId: context.invocationId,
    });

    return {
      status: 200,
      jsonBody: {
        ok: true,
        filter: OVERDUE_INVOICE_FILTER,
        fields,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    context.error("Overdue invoice reminder filter query failed", {
      invocationId: context.invocationId,
      error: message,
    });

    return {
      status: 502,
      jsonBody: {
        ok: false,
        error: "Unable to run SharePoint filter query via Microsoft Graph.",
        details: message,
      },
    };
  }
}

// Route name mirrors the business operation.
app.http("overdue-invoice-reminder", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: overdueInvoiceReminder,
});

import { mapInvoiceFields, type InvoiceReminderItem } from "./mapInvoiceFields";

// Filter to get only overdue invoices based on the "Status" field in SharePoint. This is used in the OData $filter query parameter when calling Microsoft Graph to read list items. Adjust the field name and value as needed to match your SharePoint list schema and business logic.
const OVERDUE_INVOICE_FILTER = "fields/field_13 eq 'Overdue'";

// The type of the raw SharePoint list item is not well-defined, so we use a flexible type with optional fields
type SharePointItem = {
  fields?: Record<string, unknown>;
};

// This function reads items from a SharePoint list using the Microsoft Graph API, applying a filter to get only the overdue invoices. It then maps the raw SharePoint fields to a cleaner format with business-friendly names.
export async function getSharePointListItems(
  graphAccessToken: string,
): Promise<InvoiceReminderItem[]> {
  // Config is read from environment to keep secrets/IDs out of source control.
  const siteId = process.env.SHAREPOINT_SITE_ID!;
  const listId = process.env.SHAREPOINT_LIST_ID!;

  // Construct the Microsoft Graph API endpoint for reading items from a SharePoint list.
  const listEndpoint = new URL(
    `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(
      siteId,
    )}/lists/${encodeURIComponent(listId)}/items`,
  );

  // Use OData query parameters to expand the fields and filter to only the overdue invoices.
  listEndpoint.searchParams.set("$expand", "fields");
  listEndpoint.searchParams.set("$filter", OVERDUE_INVOICE_FILTER);

  // Microsoft Graph call: caller provides a valid app-only access token.
  const listResponse = await fetch(listEndpoint, {
    method: "GET",
    headers: { Authorization: `Bearer ${graphAccessToken}` },
  });

  // Handle potential errors from the Graph API call, including parsing the error details from the response body to simplify troubleshooting.
  const listPayload = (await listResponse.json()) as {
    value?: SharePointItem[];
    error?: { code?: string; message?: string };
  };

  // If the response is not successful, throw an error with details from the Graph response to simplify troubleshooting.
  if (!listResponse.ok) {
    const graphCode = listPayload.error?.code ?? "unknown_graph_error";
    const graphMessage = listPayload.error?.message ?? "";
    // Surface status + Graph error details to simplify troubleshooting in logs.
    throw new Error(
      `Graph list read failed (${listResponse.status}) ${graphCode} ${graphMessage}`.trim(),
    );
  }

  // Map SharePoint internal keys (field_*) to readable business names. This also serves as a data validation step.
  const renamedFields = (listPayload.value ?? []).map((item) =>
    mapInvoiceFields(item.fields ?? {}),
  );

  // Return the cleaned + renamed list items to the caller, which will handle the business logic (e.g. sending reminder emails).
  return renamedFields;
}

export { OVERDUE_INVOICE_FILTER };

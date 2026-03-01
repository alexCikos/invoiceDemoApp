import {
  mapInvoiceFields,
  type InvoiceReminderItem,
} from "./mapInvoiceFields";

// Keep the filter in code so the function has one clear responsibility:
// find overdue invoices. Update this string when your business rule changes.
const OVERDUE_INVOICE_FILTER = "fields/field_13 eq 'Overdue'";

type SharePointItem = {
  fields?: Record<string, unknown>;
};

export async function getSharePointListItems(
  graphAccessToken: string,
): Promise<InvoiceReminderItem[]> {
  // Config is read from environment to keep secrets/IDs out of source control.
  const siteId = process.env.SHAREPOINT_SITE_ID!;
  const listId = process.env.SHAREPOINT_LIST_ID!;

  const listEndpoint = new URL(
    `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(
      siteId,
    )}/lists/${encodeURIComponent(listId)}/items`,
  );

  listEndpoint.searchParams.set("$expand", "fields");
  listEndpoint.searchParams.set("$filter", OVERDUE_INVOICE_FILTER);

  // Microsoft Graph call: caller provides a valid app-only access token.
  const listResponse = await fetch(listEndpoint, {
    method: "GET",
    headers: { Authorization: `Bearer ${graphAccessToken}` },
  });

  const listPayload = (await listResponse.json()) as {
    value?: SharePointItem[];
    error?: { code?: string; message?: string };
  };

  if (!listResponse.ok) {
    const graphCode = listPayload.error?.code ?? "unknown_graph_error";
    const graphMessage = listPayload.error?.message ?? "";
    // Surface status + Graph error details to simplify troubleshooting in logs.
    throw new Error(
      `Graph list read failed (${listResponse.status}) ${graphCode} ${graphMessage}`.trim(),
    );
  }

  // Return only the `fields` object from each item to keep payload focused.
  const items = listPayload.value ?? [];
  const fieldsOnly: Record<string, unknown>[] = [];

  for (const item of items) {
    const currentItemFields = item.fields ?? {};
    fieldsOnly.push(currentItemFields);
  }

  const renamedFields: InvoiceReminderItem[] = [];

  for (const currentItemFields of fieldsOnly) {
    const mappedItem = mapInvoiceFields(currentItemFields);
    renamedFields.push(mappedItem);
  }

  return renamedFields;
}

export { OVERDUE_INVOICE_FILTER };

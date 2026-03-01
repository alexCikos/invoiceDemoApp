import { getSharePointListItems } from "./getSharePointListItems";
import { getGraphAccessToken } from "../../tools/getGraphAccessToken";

// Get the overdue invoice items from SharePoint, then send reminder emails to the appropriate contacts.
export async function sendReminderEmails() {
  const graphAccessToken = await getGraphAccessToken();
  const fields = await getSharePointListItems(graphAccessToken);

  fields.forEach((field) => {
    console.log(
      `Sending reminder email for invoice ${field.InvoiceNumber} to ${field.ClientName}`,
    );
  });
}

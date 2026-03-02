export type SendEmailArgs = {
  graphAccessToken: string;
  senderMailbox: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
};

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  const endpoint = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    args.senderMailbox,
  )}/sendMail`;

  const payload = {
    message: {
      subject: args.subject,
      body: {
        contentType: "Text",
        content: args.bodyText,
      },
      toRecipients: [
        {
          emailAddress: {
            address: args.recipientEmail,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.graphAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status !== 202) {
    const errorBody = await response.text();
    throw new Error(
      `Graph sendMail failed (${response.status}) ${errorBody}`.trim(),
    );
  }
}

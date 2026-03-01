const DEFAULT_GRAPH_SCOPE = "https://graph.microsoft.com/.default";

export async function getGraphAccessToken(): Promise<string> {
  const tenantId = process.env.GRAPH_TENANT_ID!;
  const clientId = process.env.GRAPH_CLIENT_ID!;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET!;
  const scope = process.env.GRAPH_SCOPE ?? DEFAULT_GRAPH_SCOPE;

  const tokenEndpoint = `https://login.microsoftonline.com/${encodeURIComponent(
    tenantId,
  )}/oauth2/v2.0/token`;

  const tokenForm = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope,
    grant_type: "client_credentials",
  });

  const tokenResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenForm.toString(),
  });

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    const errorCode = tokenPayload.error ?? "unknown_token_error";
    const errorDescription = tokenPayload.error_description ?? "";
    throw new Error(
      `Graph token request failed (${tokenResponse.status}) ${errorCode} ${errorDescription}`.trim(),
    );
  }

  return tokenPayload.access_token;
}

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

type RequiredConfigKey =
  | "GRAPH_TENANT_ID"
  | "GRAPH_CLIENT_ID"
  | "GRAPH_CLIENT_SECRET"
  | "SHAREPOINT_SITE_ID"
  | "SHAREPOINT_LIST_ID";

const REQUIRED_CONFIG: RequiredConfigKey[] = [
  "GRAPH_TENANT_ID",
  "GRAPH_CLIENT_ID",
  "GRAPH_CLIENT_SECRET",
  "SHAREPOINT_SITE_ID",
  "SHAREPOINT_LIST_ID",
];

const DEFAULT_GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const DEFAULT_TOP = 3;
const MAX_TOP = 25;

function getMissingConfigKeys(): RequiredConfigKey[] {
  return REQUIRED_CONFIG.filter((key) => !process.env[key]?.trim());
}

function getTopValue(request: HttpRequest): number {
  const requested = Number.parseInt(request.query.get("top") ?? "", 10);
  if (Number.isNaN(requested)) {
    return DEFAULT_TOP;
  }

  if (requested < 1) {
    return 1;
  }

  if (requested > MAX_TOP) {
    return MAX_TOP;
  }

  return requested;
}

async function getGraphAccessToken(): Promise<string> {
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

async function getSharePointListItems(
  graphAccessToken: string,
  top: number,
): Promise<unknown> {
  const siteId = process.env.SHAREPOINT_SITE_ID!;
  const listId = process.env.SHAREPOINT_LIST_ID!;

  const listEndpoint = new URL(
    `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(
      siteId,
    )}/lists/${encodeURIComponent(listId)}/items`,
  );

  listEndpoint.searchParams.set("$top", String(top));
  listEndpoint.searchParams.set("$expand", "fields");

  const listResponse = await fetch(listEndpoint, {
    method: "GET",
    headers: { Authorization: `Bearer ${graphAccessToken}` },
  });

  const listPayload = (await listResponse.json()) as {
    error?: { code?: string; message?: string };
    value?: unknown[];
  };

  if (!listResponse.ok) {
    const graphCode = listPayload.error?.code ?? "unknown_graph_error";
    const graphMessage = listPayload.error?.message ?? "";
    throw new Error(
      `Graph list read failed (${listResponse.status}) ${graphCode} ${graphMessage}`.trim(),
    );
  }

  return listPayload;
}

export async function sharepointListTest(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const missingConfig = getMissingConfigKeys();
  if (missingConfig.length > 0) {
    return {
      status: 500,
      jsonBody: {
        ok: false,
        error: "Missing required app settings for Graph/SharePoint integration.",
        missingConfig,
      },
    };
  }

  const top = getTopValue(request);

  try {
    const graphAccessToken = await getGraphAccessToken();
    const listPayload = await getSharePointListItems(graphAccessToken, top);

    context.log("SharePoint list test succeeded", {
      invocationId: context.invocationId,
      top,
    });

    return {
      status: 200,
      jsonBody: {
        ok: true,
        siteId: process.env.SHAREPOINT_SITE_ID,
        listId: process.env.SHAREPOINT_LIST_ID,
        top,
        result: listPayload,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    context.error("SharePoint list test failed", {
      invocationId: context.invocationId,
      error: message,
    });

    return {
      status: 502,
      jsonBody: {
        ok: false,
        error: "Unable to read SharePoint list via Microsoft Graph.",
        details: message,
      },
    };
  }
}

app.http("sharepoint-list-test", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: sharepointListTest,
});

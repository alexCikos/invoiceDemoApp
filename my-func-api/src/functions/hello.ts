import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

const DEFAULT_NAME = "world";
const MAX_NAME_LENGTH = 80;

// Normalize user-provided names so responses stay predictable and safe to log.
function sanitizeName(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, MAX_NAME_LENGTH);
}

// For POST requests we accept either plain text ("alex") or JSON ({ "name": "alex" }).
async function readNameFromBody(request: HttpRequest): Promise<string | null> {
  if (request.method !== "POST") {
    return null;
  }

  const bodyText = (await request.text()).trim();
  if (!bodyText) {
    return null;
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    try {
      const parsedBody = JSON.parse(bodyText) as { name?: unknown };
      if (typeof parsedBody.name === "string") {
        return sanitizeName(parsedBody.name);
      }
    } catch {
      // Fall back to plain text when JSON parsing fails.
    }
  }

  return sanitizeName(bodyText);
}

export async function hello(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  // Query string wins, then POST body, then a friendly default.
  const queryName = sanitizeName(request.query.get("name"));
  const bodyName = await readNameFromBody(request);
  const name = queryName ?? bodyName ?? DEFAULT_NAME;

  context.log("Hello function processed request", {
    method: request.method,
    hasQueryName: Boolean(queryName),
    hasBodyName: Boolean(bodyName),
    invocationId: context.invocationId,
  });

  return {
    status: 200,
    jsonBody: {
      message: `Hello, ${name}!`,
      invocationId: context.invocationId,
    },
  };
}

app.http("hello", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: hello,
});

import { processWebhook } from "corsair";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { corsair } from "@/server/corsair";

export async function POST(request: NextRequest) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const contentType = request.headers.get("content-type");

  let body: unknown;

  if (contentType?.includes("application/json")) {
    body = await request.json() as unknown;
  } else {
    const text = await request.text();
    body = text.trim() ? text : {};
  }

  // Resolve tenantId dynamically from query parameters (fallback to 'dev')
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") ?? "dev";

  const result = await processWebhook(corsair, headers, body as string | Record<string, unknown>, { tenantId });

  console.info("Plugin Processed:", result.plugin, result.action);

  // Build response headers (e.g. Asana X-Hook-Secret handshake)
  // any/unknown cast needed since responseHeaders is a newer field not yet in the installed type definitions
  const responseHeaders = result.responseHeaders;
  const nextHeaders = new Headers();
  if (responseHeaders) {
    for (const [key, value] of Object.entries(responseHeaders)) {
      nextHeaders.set(key, value);
    }
  }

  // Handle case where no webhook matched
  if (!result.response) {
    return NextResponse.json(
      {
        success: false,
        message: "No matching webhook handler found",
      },
      { status: 404 },
    );
  }

  if (result.response !== undefined) {
    return NextResponse.json(result.response, { headers: nextHeaders });
  }

  // Webhook processed successfully, but no data to return to sender
  return new NextResponse(null, { status: 200, headers: nextHeaders });
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}

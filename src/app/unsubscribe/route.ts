import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { suppressionList } from "@/server/db/schema";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  const email = searchParams.get("email");

  if (!orgId || !email) {
    return new NextResponse("Missing orgId or email", { status: 400 });
  }

  try {
    await db
      .insert(suppressionList)
      .values({
        orgId,
        email: email.toLowerCase().trim(),
      })
      .onConflictDoNothing();

    // Return a sleek minimal HTML page celebrating the unsubscribe confirmation
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Unsubscribed</title>
        <style>
          body {
            background: #09090b;
            color: #fafafa;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
          }
          .card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 40px;
            max-width: 400px;
            text-align: center;
            backdrop-filter: blur(16px);
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
          }
          h1 {
            font-size: 24px;
            margin-bottom: 16px;
            background: linear-gradient(135deg, #a78bfa, #818cf8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          p {
            color: #a1a1aa;
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 24px;
          }
          .badge {
            display: inline-block;
            background: rgba(139, 92, 246, 0.1);
            color: #c084fc;
            padding: 6px 12px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 500;
            border: 1px solid rgba(139, 92, 246, 0.2);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Successfully Unsubscribed</h1>
          <p>You have been unsubscribed from all future marketing and bulk campaigns sent from this sender.</p>
          <div class="badge">${email.toLowerCase()}</div>
        </div>
      </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

import { NextResponse } from "next/server";

export async function GET() {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Gusion Mail API Documentation</title>
        <style>
          body {
            margin: 0;
            background: #09090b;
          }
        </style>
      </head>
      <body>
        <script
          id="api-reference"
          data-url="/api/openapi"
          data-configuration='{"theme": "purple"}'
        ></script>
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
      </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}

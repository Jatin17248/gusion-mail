export function encodeRawEmail(opts: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    ...(opts.from ? [`From: ${opts.from}`] : []),
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    ...(opts.inReplyTo ? [`In-Reply-To: ${opts.inReplyTo}`] : []),
    ...(opts.references ? [`References: ${opts.references}`] : []),
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    "",
    opts.body,
  ];
  const message = lines.join("\r\n");
  const base64 = Buffer.from(message, "utf-8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function decodeMimeWord(
  charset: string,
  encoding: string,
  value: string,
): string {
  try {
    const normalizedCharset = charset.toLowerCase();
    const normalizedEncoding = encoding.toUpperCase();

    let buffer: Buffer;
    if (normalizedEncoding === "B") {
      buffer = Buffer.from(value, "base64");
    } else {
      const bytes: number[] = [];
      const input = value.replace(/_/g, " ");

      for (let i = 0; i < input.length; i++) {
        if (
          input[i] === "=" &&
          /[0-9A-Fa-f]{2}/.test(input.slice(i + 1, i + 3))
        ) {
          bytes.push(Number.parseInt(input.slice(i + 1, i + 3), 16));
          i += 2;
        } else {
          bytes.push(input.charCodeAt(i));
        }
      }

      buffer = Buffer.from(bytes);
    }

    if (
      normalizedCharset === "latin1" ||
      normalizedCharset === "iso-8859-1" ||
      normalizedCharset === "iso8859-1"
    ) {
      return buffer.toString("latin1");
    }

    return buffer.toString("utf-8");
  } catch {
    return value;
  }
}

export function decodeMimeHeaderValue(value: string): string {
  if (!value) return "";

  return value
    .replace(
      /=\?([^?]+)\?([bBqQ])\?([^?]+)\?=/g,
      (_match, charset: string, encoding: string, encoded: string) =>
        decodeMimeWord(charset, encoding, encoded),
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function decodeHtmlEntity(entity: string): string {
  switch (entity) {
    case "&nbsp;":
      return " ";
    case "&amp;":
      return "&";
    case "&lt;":
      return "<";
    case "&gt;":
      return ">";
    case "&quot;":
      return '"';
    case "&#39;":
    case "&apos;":
      return "'";
    default:
      return entity;
  }
}

export function htmlToPlainText(value: string): string {
  if (!value) return "";

  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<\/td>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(
      /&(nbsp|amp|lt|gt|quot|apos|#39);/g,
      (entity) => decodeHtmlEntity(entity),
    )
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function buildEmailPreview(opts: {
  snippet?: string | null;
  body?: string | null;
  maxLength?: number;
}): string {
  const maxLength = opts.maxLength ?? 180;
  const snippet = opts.snippet?.trim() ?? "";
  const body = opts.body?.trim() ?? "";

  const previewSource =
    snippet ||
    (body.includes("<") && body.includes(">") ? htmlToPlainText(body) : body);

  if (!previewSource) return "";

  return previewSource.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

export function extractBodyFromPayload(payload?: GmailPart): string {
  if (!payload) return "";

  const findPart = (part: GmailPart, mimeType: string): string | null => {
    if (part.mimeType === mimeType && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
    for (const subPart of part.parts ?? []) {
      const found = findPart(subPart, mimeType);
      if (found) return found;
    }
    return null;
  };

  const html = findPart(payload, "text/html");
  if (html) return html;

  const plain = findPart(payload, "text/plain");
  if (plain) return plain;

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  return "";
}

export function getHeader(
  headers: { name?: string; value?: string }[] | undefined,
  name: string,
): string {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
    ""
  );
}

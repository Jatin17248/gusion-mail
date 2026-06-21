export interface OutgoingAttachment {
  filename: string;
  mimeType: string;
  /** base64-encoded file contents */
  data: string;
}

function toBase64Url(message: string): string {
  return Buffer.from(message, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Wrap a base64 string into 76-char lines per RFC 2045. */
function wrapBase64(data: string): string {
  return data.replace(/[\r\n]/g, "").replace(/.{76}/g, "$&\r\n");
}

export function encodeRawEmail(opts: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  cc?: string;
  bcc?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: OutgoingAttachment[];
}): string {
  const headers = [
    ...(opts.from ? [`From: ${opts.from}`] : []),
    `To: ${opts.to}`,
    ...(opts.cc?.trim() ? [`Cc: ${opts.cc}`] : []),
    ...(opts.bcc?.trim() ? [`Bcc: ${opts.bcc}`] : []),
    `Subject: ${opts.subject}`,
    ...(opts.inReplyTo ? [`In-Reply-To: ${opts.inReplyTo}`] : []),
    ...(opts.references ? [`References: ${opts.references}`] : []),
    "MIME-Version: 1.0",
  ];

  const attachments = opts.attachments ?? [];

  // Simple text email when there are no attachments.
  if (attachments.length === 0) {
    const message = [
      ...headers,
      "Content-Type: text/plain; charset=utf-8",
      "",
      opts.body,
    ].join("\r\n");
    return toBase64Url(message);
  }

  // multipart/mixed: text body + each attachment as a base64 part.
  const boundary = `gusion_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2)}`;

  const parts: string[] = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    opts.body,
  ];

  for (const att of attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.mimeType}; name="${att.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${att.filename}"`,
      "",
      wrapBase64(att.data),
    );
  }
  parts.push(`--${boundary}--`);

  return toBase64Url(parts.join("\r\n"));
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
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name?: string; value?: string }[];
  body?: { data?: string; attachmentId?: string; size?: number };
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

export interface EmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

/** Inline images (logos, signatures referenced by cid:) shouldn't show up as
 * downloadable attachments — Gmail hides them too. */
function isInlineImage(part: GmailPart): boolean {
  if (!part.mimeType?.startsWith("image/")) return false;
  const disposition =
    part.headers
      ?.find((h) => h.name?.toLowerCase() === "content-disposition")
      ?.value?.toLowerCase() ?? "";
  const hasContentId = part.headers?.some(
    (h) => h.name?.toLowerCase() === "content-id",
  );
  return disposition.includes("inline") || !!hasContentId;
}

/** Walk the MIME tree and collect real (non-inline) attachments with the
 * metadata needed to render a chip and lazily download the bytes. */
export function extractAttachmentsFromPayload(
  payload?: GmailPart,
): EmailAttachment[] {
  if (!payload) return [];
  const attachments: EmailAttachment[] = [];

  const walk = (part: GmailPart) => {
    const filename = part.filename?.trim();
    const attachmentId = part.body?.attachmentId;
    if (filename && attachmentId && !isInlineImage(part)) {
      attachments.push({
        attachmentId,
        filename,
        mimeType: part.mimeType ?? "application/octet-stream",
        size: part.body?.size ?? 0,
      });
    }
    for (const sub of part.parts ?? []) walk(sub);
  };

  walk(payload);
  return attachments;
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

/** Extract a safe, user-facing message from an unknown thrown value. */
export function errorMessage(err: unknown, fallback = "Unexpected error"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
}

/** Parse a JSON string into an array of strings, ignoring malformed input. */
export function parseStringArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const raw: unknown = JSON.parse(json);
    return Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

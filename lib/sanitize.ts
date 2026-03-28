export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function sanitizeUserInput(
  obj: Record<string, any>,
  keys: string[]
): Record<string, any> {
  const result = { ...obj };
  for (const key of keys) {
    if (typeof result[key] === "string") {
      result[key] = escapeHtml(result[key]);
    }
  }
  return result;
}

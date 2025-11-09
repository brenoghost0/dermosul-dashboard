export function sanitizeDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

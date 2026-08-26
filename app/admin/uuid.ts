/** Generate a browser-compatible UUID without relying on crypto.randomUUID. */
export function createClientId(prefix = "id"): string {
  const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const uuid = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${prefix}-${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
  }
  // The server replaces missing ids on save. This deterministic fallback is
  // only a short-lived client key for React and never becomes a DB id.
  return `${prefix}-${Date.now().toString(36)}-${Math.abs((Date.now() * 31) % 100000).toString(36)}`;
}

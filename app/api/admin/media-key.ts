export type MediaResource = "portfolio_items" | "offers" | "salon_settings";

/** Build a unique Object Storage key without placing a database namespace separator in the path. */
export function mediaStorageKey(resource: MediaResource, id: string, extension: string): string {
  const storageId = id.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `media/${resource}/${storageId}/${crypto.randomUUID()}.${extension}`;
}

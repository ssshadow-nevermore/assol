export function resolveMediaUrl(imageUrl: string | null, storageKey: string | null): string {
  if (imageUrl) return imageUrl;
  if (!storageKey) return "";
  return `/media/${storageKey.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

export function shouldBypassImageOptimizer(src: string): boolean {
  return src.startsWith("/media/");
}

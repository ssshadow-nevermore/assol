import { getYandexObject, isSafeStorageKey } from "../../api/admin/yandex-storage";
import { runtimeEnv } from "../../api/admin/auth-runtime";

function decodedKey(path: string): string | null {
  try {
    const key = path.split("/").map((segment) => decodeURIComponent(segment)).join("/");
    if (!isSafeStorageKey(key)) return null;
    return key;
  } catch {
    return null;
  }
}

function requestedByteRange(value: string | null, size: number): [number, number] | null {
  const match = value?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const startValue = match[1] ? Number(match[1]) : null;
  const endValue = match[2] ? Number(match[2]) : null;
  if (startValue === null && endValue === null) return null;
  const start = startValue === null ? Math.max(0, size - (endValue ?? 0)) : startValue;
  const end = endValue === null ? size - 1 : endValue;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= size || end < start) return null;
  return [start, Math.min(end, size - 1)];
}

export async function GET(request: Request, context: { params: Promise<{ path?: string[] }> }): Promise<Response> {
  const params = await context.params;
  const key = decodedKey((params.path ?? []).join("/"));
  if (!key) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  try {
    const object = await getYandexObject(await runtimeEnv(), key);
    if (!object.ok) return new Response("Not found", { status: object.status === 404 ? 404 : 502, headers: { "Cache-Control": "no-store" } });
    const headers = new Headers();
    // Preserve the metadata needed by Safari/WebKit to initialise a video
    // element. In particular, a chunked response without Content-Length or
    // byte-range support can remain at readyState=0 on iOS even though
    // Chromium renders the same object.
    for (const name of ["content-type", "content-length", "accept-ranges", "etag", "last-modified"]) {
      const value = object.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      const bytes = new Uint8Array(await object.arrayBuffer());
      const range = requestedByteRange(rangeHeader, bytes.byteLength);
      if (!range) {
        headers.set("content-range", `bytes */${bytes.byteLength}`);
        return new Response(null, { status: 416, headers });
      }
      const [start, end] = range;
      headers.set("content-length", String(end - start + 1));
      headers.set("content-range", `bytes ${start}-${end}/${bytes.byteLength}`);
      return new Response(bytes.slice(start, end + 1), { status: 206, headers });
    }
    headers.set("cache-control", "public, max-age=31536000, immutable");
    return new Response(object.body, { status: 200, headers });
  } catch (error) {
    console.error(JSON.stringify({ message: "Media read failed", error: error instanceof Error ? error.message : String(error) }));
    return new Response("Media unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

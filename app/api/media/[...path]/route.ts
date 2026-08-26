/** Compatibility route for the bundled Safari award video. */
export async function GET(request: Request, context: { params: Promise<{ path?: string[] }> }): Promise<Response> {
  const params = await context.params;
  if ((params.path ?? []).join("/") !== "good-place-2026-safari.mp4") {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const bytes = new Uint8Array(await readFile(new URL("../../../../public/media/good-place-2026-safari.mp4", import.meta.url)));
    const headers = new Headers({ "content-type": "video/mp4", "accept-ranges": "bytes", "content-length": String(bytes.byteLength) });
    // Returning the complete small fallback avoids a WebKit decoder quirk on
    // the first tiny range probe; the main media route handles managed files.
    return new Response(bytes.buffer as ArrayBuffer, { status: 200, headers });
  } catch (error) {
    console.error(JSON.stringify({ message: "Bundled media read failed", error: error instanceof Error ? error.message : String(error) }));
    return new Response("Media unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

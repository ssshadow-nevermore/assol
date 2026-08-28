import { invalidateAdminSession, isSameOriginRequest, clearSessionCookie } from "../access";
import { getAuthRuntime } from "../auth-runtime";

export async function POST(request: Request): Promise<Response> {
  try {
    const runtime = await getAuthRuntime();
    if (!isSameOriginRequest(request, runtime)) {
      return Response.json({ error: "Недопустимый источник запроса" }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    await invalidateAdminSession(request, runtime);
    return Response.json({ ok: true }, {
      headers: { "Cache-Control": "no-store", "Set-Cookie": clearSessionCookie(request) },
    });
  } catch (error) {
    console.error(JSON.stringify({ message: "Admin logout failed", error: error instanceof Error ? error.message : String(error) }));
    return Response.json({ error: "Не удалось завершить сессию" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(): Promise<Response> {
  return Response.json({ error: "Метод не поддерживается" }, { status: 405, headers: { "Cache-Control": "no-store", Allow: "POST" } });
}

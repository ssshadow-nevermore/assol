import { authenticateLogin, isSameOriginRequest } from "../access";
import { getAuthRuntime } from "../auth-runtime";

function noStore(headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  result.set("Cache-Control", "no-store");
  return result;
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Недопустимый источник запроса" }, { status: 403, headers: noStore() });
  }
  try {
    const body = await request.json() as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Неверный логин или пароль" }, { status: 401, headers: noStore() });
    }
    const record = body as Record<string, unknown>;
    const login = typeof record.login === "string" ? record.login : "";
    const password = typeof record.password === "string" ? record.password : "";
    // Bound request processing without exposing validation details. PBKDF2 is
    // still performed for unknown logins when configured secrets are present.
    if (login.length > 256 || password.length > 4096) {
      return Response.json({ error: "Неверный логин или пароль" }, { status: 401, headers: noStore() });
    }
    const response = await authenticateLogin(request, login, password, await getAuthRuntime());
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Неверный логин или пароль" }, { status: 401, headers: noStore() });
    }
    console.error(JSON.stringify({ message: "Admin login failed", error: error instanceof Error ? error.message : String(error) }));
    return Response.json({ error: "Авторизация временно недоступна" }, { status: 503, headers: noStore() });
  }
}

export async function GET(): Promise<Response> {
  return Response.json({ error: "Метод не поддерживается" }, { status: 405, headers: noStore({ Allow: "POST" }) });
}

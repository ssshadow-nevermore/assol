import { buildBookingMessage } from "../../booking/booking-message.mjs";
import { catalogCategories, getMasters } from "../../services-data";

const SALON_EMAIL = "jokerz44677@gmail.com";
const ALLOWED_TIMES = new Set(["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:00"]);

type BookingBody = {
  categoryId?: unknown;
  serviceId?: unknown;
  masterId?: unknown;
  date?: unknown;
  time?: unknown;
  name?: unknown;
  phone?: unknown;
  comment?: unknown;
};

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function jsonError(message: string, status: number) {
  return Response.json({ success: false, message }, { status });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 12_000) return jsonError("Слишком большой запрос.", 413);

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return jsonError("Запрос отклонён.", 403);

  let body: BookingBody;
  try {
    body = await request.json() as BookingBody;
  } catch {
    return jsonError("Некорректный формат заявки.", 400);
  }

  const categoryId = text(body.categoryId, 40);
  const serviceId = text(body.serviceId, 80);
  const masterId = text(body.masterId, 40);
  const date = text(body.date, 10);
  const time = text(body.time, 5);
  const name = text(body.name, 60);
  const phone = text(body.phone, 24);
  const comment = text(body.comment, 500);
  const phoneDigits = phone.replace(/\D/g, "");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());

  const category = catalogCategories.find((item) => item.id === categoryId);
  const service = category?.items.find((item) => item.id === serviceId);
  const master = category ? getMasters(category.masterIds).find((item) => item.id === masterId) : undefined;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today;

  if (!category || !service || !master || !validDate || !ALLOWED_TIMES.has(time) || name.length < 2 || phoneDigits.length < 10 || phoneDigits.length > 15) {
    return jsonError("Проверьте заполненные данные.", 400);
  }

  const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
  if (!accessKey) return jsonError("Сервис отправки временно недоступен.", 503);

  const formattedDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
  const message = buildBookingMessage({
    category: category.title,
    service: service.name,
    price: service.price,
    master: master.name,
    date: formattedDate,
    time,
    name,
    phone,
    comment: comment === "Не указан" ? "" : comment,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        access_key: accessKey,
        subject: `Новая заявка: ${service.name}`,
        from_name: "Сайт салона «Ассоль»",
        recipient: SALON_EMAIL,
        name,
        phone,
        category: category.title,
        service: service.name,
        price: service.price,
        master: master.name,
        date: formattedDate,
        time,
        comment: comment || "Не указан",
        message,
        botcheck: "",
      }),
    });
    const result = await response.json().catch(() => null) as { success?: boolean } | null;
    if (!response.ok || !result?.success) return jsonError("Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.", 502);
    return Response.json({ success: true });
  } catch {
    return jsonError("Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.", 502);
  } finally {
    clearTimeout(timeoutId);
  }
}

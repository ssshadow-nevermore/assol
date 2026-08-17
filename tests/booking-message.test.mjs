import assert from "node:assert/strict";
import test from "node:test";
import { buildBookingMessage } from "../app/booking/booking-message.mjs";

test("builds a complete email booking template", () => {
  const message = buildBookingMessage({
    category: "Окрашивание волос",
    service: "Окрашивание в один тон",
    price: "2 000 ₽",
    master: "Джулия",
    date: "20 августа 2026 г.",
    time: "12:00",
    name: "Анна",
    phone: "+7 999 000-00-00",
    comment: "Безаммиачная краска",
  });

  assert.match(message, /Направление: Окрашивание волос/);
  assert.match(message, /Услуга: Окрашивание в один тон/);
  assert.match(message, /Мастер: Джулия/);
  assert.match(message, /Желаемые дата и время: 20 августа 2026 г\., 12:00/);
  assert.match(message, /Имя: Анна/);
  assert.match(message, /Телефон: \+7 999 000-00-00/);
  assert.match(message, /Комментарий: Безаммиачная краска/);
});

test("omits an empty optional comment", () => {
  const message = buildBookingMessage({ category: "Маникюр", service: "Маникюр", price: "700 ₽", master: "Елена", date: "21 августа 2026 г.", time: "10:30", name: "Ирина", phone: "+79990000000" });
  assert.doesNotMatch(message, /Комментарий:/);
});

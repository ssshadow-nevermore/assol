import assert from "node:assert/strict";
import test from "node:test";
import { buildVkBookingMessage, buildVkMessageUrl } from "../app/booking/vk-message.mjs";

test("builds a complete VK booking template", () => {
  const message = buildVkBookingMessage({
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
  assert.match(message, /Имя: Анна/);
  assert.match(message, /Комментарий: Безаммиачная краска/);
});

test("uses VK's write link and keeps the full template in text", () => {
  const message = "Строка 1\nСтрока 2: тест";
  const url = buildVkMessageUrl(message);

  assert.equal(url.startsWith("https://vk.com/write-232132454?text="), true);
  assert.equal(decodeURIComponent(url.split("?text=")[1]), message);
});

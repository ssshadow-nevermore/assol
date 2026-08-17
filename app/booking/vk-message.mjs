export const VK_COMMUNITY_ID = "232132454";

export function buildVkBookingMessage({
  category,
  service,
  price,
  master,
  date,
  time,
  name,
  phone,
  comment = "",
}) {
  return [
    "Здравствуйте! Хочу записаться в салон «Ассоль».",
    `Направление: ${category}`,
    `Услуга: ${service}`,
    `Стоимость по прайсу: ${price}`,
    `Мастер: ${master}`,
    `Желаемые дата и время: ${date}, ${time}`,
    `Имя: ${name}`,
    `Телефон: ${phone}`,
    comment.trim() ? `Комментарий: ${comment.trim()}` : "",
  ].filter(Boolean).join("\n");
}

export function buildVkMessageUrl(message) {
  return `https://vk.com/write-${VK_COMMUNITY_ID}?text=${encodeURIComponent(message)}`;
}

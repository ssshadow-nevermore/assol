"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { catalogCategories, getMasters } from "../services-data";

const times = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:00"];
const vkCommunityId = "232132454";

const summaryImages: Record<string, { src: string; alt: string; position: string }> = {
  color: { src: "/images/booking-color.jpg", alt: "Окрашивание волос до и после в салоне Ассоль", position: "center 38%" },
  women: { src: "/images/booking-women.jpg", alt: "Женская стрижка в салоне Ассоль", position: "center 40%" },
  men: { src: "/images/booking-men.jpg", alt: "Мужская стрижка до и после в салоне Ассоль", position: "center 38%" },
  children: { src: "/images/booking-children.jpg", alt: "Короткая стрижка до и после в салоне Ассоль", position: "center 38%" },
  texture: { src: "/images/booking-texture.jpg", alt: "Укладка и объём волос до и после в салоне Ассоль", position: "center 35%" },
  manicure: { src: "/images/booking-manicure.jpg", alt: "Маникюр в салоне Ассоль", position: "center 50%" },
  pedicure: { src: "/images/booking-pedicure.jpg", alt: "Педикюр в салоне Ассоль", position: "center 46%" },
  depilation: { src: "/images/booking-depilation.jpg", alt: "Коррекция и депиляция зоны лица до и после в салоне Ассоль", position: "center 42%" },
  brows: { src: "/images/booking-brows.jpg", alt: "Архитектура и окрашивание бровей до и после в салоне Ассоль", position: "center 50%" },
};

export default function BookingPage() {
  const firstCategory = catalogCategories[0];
  const [categoryId, setCategoryId] = useState(firstCategory.id);
  const [itemId, setItemId] = useState(firstCategory.items[0].id);
  const [masterId, setMasterId] = useState(firstCategory.masterIds[0]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);

  const selectedCategory = catalogCategories.find((category) => category.id === categoryId) ?? firstCategory;
  const selectedService = selectedCategory.items.find((item) => item.id === itemId) ?? selectedCategory.items[0];
  const summaryImage = summaryImages[selectedCategory.id] ?? summaryImages.color;
  const availableMasters = getMasters(selectedCategory.masterIds);
  const selectedMaster = availableMasters.find((master) => master.id === masterId) ?? availableMasters[0];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
  const ready = Boolean(categoryId && itemId && selectedMaster && date && time && name.trim() && phone.trim());

  function selectCategory(categoryIdToSelect: string) {
    const category = catalogCategories.find((item) => item.id === categoryIdToSelect) ?? firstCategory;
    setCategoryId(category.id);
    setItemId(category.items[0].id);
    setMasterId(category.masterIds[0]);
    setSubmitted(false);
    setMessageCopied(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !selectedMaster) return;

    const formattedDate = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${date}T12:00:00`));
    const message = [
      "Здравствуйте! Хочу записаться в салон «Ассоль».",
      `Направление: ${selectedCategory.title}`,
      `Услуга: ${selectedService.name}`,
      `Стоимость по прайсу: ${selectedService.price}`,
      `Мастер: ${selectedMaster.name}`,
      `Желаемые дата и время: ${formattedDate}, ${time}`,
      `Имя: ${name.trim()}`,
      `Телефон: ${phone.trim()}`,
      comment.trim() ? `Комментарий: ${comment.trim()}` : "",
    ].filter(Boolean).join("\n");

    const vkMessageUrl = `https://vk.ru/write-${vkCommunityId}?text=${encodeURIComponent(message)}`;

    setSubmitted(true);
    setMessageCopied(false);
    window.open(vkMessageUrl, "_blank", "noopener,noreferrer");

    if (navigator.clipboard) {
      void navigator.clipboard.writeText(message)
        .then(() => setMessageCopied(true))
        .catch(() => setMessageCopied(false));
    }
  }

  return (
    <main className="booking-page">
      <header className="booking-header">
        {/* A native link intentionally forces a full page load in the hosted build. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="brand" href="/#top" aria-label="Ассоль — на главную">
          <span>Ассоль</span><small>салон красоты</small>
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="booking-back" href="/#top">← Вернуться на сайт</a>
        <a className="header-phone" href="tel:+79035150818">+7 903 515-08-18</a>
      </header>

      <section className="booking-intro">
        <div>
          <p className="eyebrow">Запись в салон</p>
          <h1>Выберите время<br /><em>для себя</em></h1>
        </div>
        <p>Выберите точную услугу и мастера. Администратор проверит расписание и подтвердит запись во ВКонтакте или по телефону.</p>
      </section>

      <form className="booking-layout" onSubmit={submit}>
        <div className="booking-form">
          <fieldset className="booking-step">
            <legend><span>01</span><strong>Направление</strong><small>С чего начнём?</small></legend>
            <div className="booking-categories">
              {catalogCategories.map((category) => (
                <button
                  className={category.id === categoryId ? "category-choice active" : "category-choice"}
                  type="button"
                  key={category.id}
                  onClick={() => selectCategory(category.id)}
                  aria-pressed={category.id === categoryId}
                >
                  <span>{category.number}</span><strong>{category.shortTitle}</strong><small>{category.priceFrom}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="booking-step">
            <legend><span>02</span><strong>Услуга</strong><small>{selectedCategory.title}</small></legend>
            {selectedCategory.priceNote && <p className="booking-price-note">{selectedCategory.priceNote}</p>}
            <div className="booking-services detailed">
              {selectedCategory.items.map((service) => (
                <button
                  className={service.id === itemId ? "service-choice active" : "service-choice"}
                  type="button"
                  key={service.id}
                  onClick={() => { setItemId(service.id); setSubmitted(false); setMessageCopied(false); }}
                  aria-pressed={service.id === itemId}
                >
                  <span>{service.name}</span>
                  {service.note && <small>{service.note}</small>}
                  <strong>{service.price}</strong>
                  {service.duration && <em>{service.duration}</em>}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="booking-step master-step">
            <legend><span>03</span><strong>Мастер</strong><small>Специалисты по выбранной услуге</small></legend>
            <div className="master-choices">
              {availableMasters.map((master) => (
                <button
                  className={master.id === selectedMaster?.id ? "master-choice active" : "master-choice"}
                  type="button"
                  key={master.id}
                  onClick={() => { setMasterId(master.id); setSubmitted(false); setMessageCopied(false); }}
                  aria-pressed={master.id === selectedMaster?.id}
                >
                  <span className="master-initial">{master.initial}</span>
                  <span><strong>{master.name}</strong><small>{master.role}</small></span>
                  <i aria-hidden="true">✓</i>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="booking-step">
            <legend><span>04</span><strong>Дата и время</strong><small>Укажите удобное окно</small></legend>
            <label className="date-field"><span>Желаемая дата</span><input type="date" value={date} min={today} onChange={(event) => setDate(event.target.value)} required /></label>
            <div className="time-grid" aria-label="Желаемое время">
              {times.map((item) => <button className={time === item ? "time-choice active" : "time-choice"} type="button" key={item} onClick={() => setTime(item)} aria-pressed={time === item}>{item}</button>)}
            </div>
            <p className="booking-hint">Выбранное время — пожелание. Администратор подтвердит его или предложит ближайшее свободное.</p>
          </fieldset>

          <fieldset className="booking-step">
            <legend><span>05</span><strong>Ваши контакты</strong><small>Чтобы подтвердить запись</small></legend>
            <div className="contact-fields">
              <label><span>Имя</span><input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Как к вам обращаться" autoComplete="name" required /></label>
              <label><span>Телефон</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+7 999 000-00-00" autoComplete="tel" required /></label>
              <label className="wide"><span>Комментарий <small>необязательно</small></span><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Расскажите о пожеланиях или задайте вопрос" rows={4} /></label>
            </div>
          </fieldset>
        </div>

        <aside className="booking-summary">
          <div className="summary-image">
            <Image
              key={selectedCategory.id}
              src={summaryImage.src}
              alt={summaryImage.alt}
              fill
              sizes="(max-width: 900px) 100vw, 34vw"
              style={{ objectPosition: summaryImage.position }}
            />
          </div>
          <div className="summary-content">
            <p className="eyebrow">Ваша запись</p>
            <h2>{selectedService.name}</h2>
            <p className="summary-category">{selectedCategory.title}</p>
            <dl>
              <div><dt>Мастер</dt><dd>{selectedMaster?.name}</dd></div>
              <div><dt>Дата</dt><dd>{date ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`)) : "Не выбрана"}</dd></div>
              <div><dt>Время</dt><dd>{time || "Не выбрано"}</dd></div>
              <div><dt>Стоимость</dt><dd>{selectedService.price}</dd></div>
              <div><dt>Длительность</dt><dd>{selectedService.duration || "уточним"}</dd></div>
            </dl>
            <button className="booking-submit" type="submit" disabled={!ready}>Отправить заявку <span>→</span></button>
            <p className="summary-note">Нажимая кнопку, вы переходите в сообщения «Ассоль» во ВКонтакте с готовой заявкой. Отправьте её, и мы подтвердим запись.</p>
            {submitted && (
              <p className="booking-success" role="status">
                Заявка открыта во ВКонтакте с готовым текстом.{messageCopied ? " На всякий случай мы также скопировали её — можно вставить вручную." : " Осталось нажать «Отправить»."}
              </p>
            )}
          </div>
        </aside>
      </form>

      <footer className="booking-footer"><span>Пушкино · Московский проспект, 44</span><span>Ежедневно · 09:00–20:00</span></footer>
    </main>
  );
}

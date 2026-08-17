"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { catalogCategories, getMasters } from "../services-data";
import { buildBookingMessage } from "./booking-message.mjs";

const WEB3FORMS_ACCESS_KEY = "bced2591-0bba-4e8a-ae26-060c040ec31a";
const SALON_EMAIL = "jokerz44677@gmail.com";

type SubmitState = "idle" | "sending" | "success" | "error";

const times = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:00"];

const summaryImages: Record<string, { src: string; alt: string; position: string }> = {
  color: { src: "/images/clean-color.webp", alt: "Окрашивание волос в салоне Ассоль", position: "center 38%" },
  women: { src: "/images/clean-women-bob.webp", alt: "Женская стрижка в салоне Ассоль", position: "center 42%" },
  men: { src: "/images/clean-men.webp", alt: "Мужская стрижка в салоне Ассоль", position: "center 38%" },
  children: { src: "/images/clean-children.webp", alt: "Короткая стрижка в салоне Ассоль", position: "center 38%" },
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
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const selectedCategory = catalogCategories.find((category) => category.id === categoryId) ?? firstCategory;
  const selectedService = selectedCategory.items.find((item) => item.id === itemId) ?? selectedCategory.items[0];
  const summaryImage = summaryImages[selectedCategory.id] ?? summaryImages.color;
  const availableMasters = getMasters(selectedCategory.masterIds);
  const selectedMaster = availableMasters.find((master) => master.id === masterId) ?? availableMasters[0];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
  const phoneDigits = phone.replace(/\D/g, "");
  const ready = Boolean(categoryId && itemId && selectedMaster && date >= today && time && name.trim().length >= 2 && phoneDigits.length >= 10 && phoneDigits.length <= 15);
  const formattedDate = date
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`))
    : "не выбрана";
  const bookingMessage = buildBookingMessage({
    category: selectedCategory.title,
    service: selectedService.name,
    price: selectedService.price,
    master: selectedMaster?.name ?? "не выбран",
    date: formattedDate,
    time: time || "не выбрано",
    name: name.trim() || "не указано",
    phone: phone.trim() || "не указан",
    comment,
  });

  function resetSubmitState() {
    setSubmitState("idle");
  }

  function selectCategory(categoryIdToSelect: string) {
    const category = catalogCategories.find((item) => item.id === categoryIdToSelect) ?? firstCategory;
    setCategoryId(category.id);
    setItemId(category.items[0].id);
    setMasterId(category.masterIds[0]);
    resetSubmitState();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !selectedMaster || submitState === "sending") return;

    setSubmitState("sending");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          subject: `Новая заявка: ${selectedService.name}`,
          from_name: "Сайт салона «Ассоль»",
          recipient: SALON_EMAIL,
          name: name.trim(),
          phone: phone.trim(),
          category: selectedCategory.title,
          service: selectedService.name,
          price: selectedService.price,
          master: selectedMaster.name,
          date: formattedDate,
          time,
          comment: comment.trim() || "Не указан",
          message: bookingMessage,
          botcheck: "",
        }),
      });
      const result = await response.json() as { success?: boolean };

      if (!response.ok || !result.success) throw new Error("Submission failed");
      setSubmitState("success");
    } catch {
      setSubmitState("error");
    } finally {
      window.clearTimeout(timeoutId);
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
        <p>Выберите точную услугу и мастера. Заявка сразу придёт администратору, а запись подтвердят по телефону.</p>
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
                  onClick={() => { setItemId(service.id); resetSubmitState(); }}
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
                  onClick={() => { setMasterId(master.id); resetSubmitState(); }}
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
            <label className="date-field"><span>Желаемая дата</span><input type="date" value={date} min={today} onInput={(event) => { setDate(event.currentTarget.value); resetSubmitState(); }} required /></label>
            <div className="time-grid" aria-label="Желаемое время">
              {times.map((item) => <button className={time === item ? "time-choice active" : "time-choice"} type="button" key={item} onClick={() => { setTime(item); resetSubmitState(); }} aria-pressed={time === item}>{item}</button>)}
            </div>
            <p className="booking-hint">Выбранное время — пожелание. Администратор подтвердит его или предложит ближайшее свободное.</p>
          </fieldset>

          <fieldset className="booking-step">
            <legend><span>05</span><strong>Ваши контакты</strong><small>Чтобы подтвердить запись</small></legend>
            <div className="contact-fields">
              <label><span>Имя</span><input type="text" value={name} onInput={(event) => { setName(event.currentTarget.value); resetSubmitState(); }} placeholder="Как к вам обращаться" autoComplete="name" minLength={2} maxLength={60} required /></label>
              <label><span>Телефон</span><input type="tel" value={phone} onInput={(event) => { setPhone(event.currentTarget.value); resetSubmitState(); }} placeholder="+7 999 000-00-00" autoComplete="tel" inputMode="tel" minLength={10} maxLength={24} pattern="[+0-9()\s-]{10,24}" title="Введите номер телефона: от 10 до 15 цифр" required /></label>
              <label className="wide"><span>Комментарий <small>необязательно</small></span><textarea value={comment} onInput={(event) => { setComment(event.currentTarget.value); resetSubmitState(); }} placeholder="Расскажите о пожеланиях или задайте вопрос" rows={4} maxLength={500} /></label>
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
            <details className="summary-message-preview">
              <summary>Что получит администратор</summary>
              <pre>{bookingMessage}</pre>
            </details>
            <button className="booking-submit" type="submit" disabled={!ready || submitState === "sending" || submitState === "success"}>
              {submitState === "sending" ? "Отправляем…" : submitState === "success" ? "Заявка отправлена" : "Отправить заявку"}
              <span>{submitState === "success" ? "✓" : "→"}</span>
            </button>
            <p className="summary-note">Нажимая кнопку, вы отправляете заявку администратору салона. Переходить на другой сайт не потребуется.</p>
            {submitState === "success" && (
              <p className="booking-success" role="status"><span aria-hidden="true">✓</span><strong>Заявка отправлена</strong> Администратор свяжется с вами по телефону для подтверждения записи.</p>
            )}
            {submitState === "error" && (
              <p className="booking-error" role="alert"><strong>Не удалось отправить заявку.</strong> Проверьте подключение к интернету и попробуйте ещё раз или позвоните по номеру +7 903 515-08-18.</p>
            )}
          </div>
        </aside>
      </form>

      <footer className="booking-footer"><span>Пушкино · Московский проспект, 44</span><span>Ежедневно · 09:00–20:00</span></footer>
    </main>
  );
}

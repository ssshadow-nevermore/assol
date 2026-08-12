"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Service = {
  id: string;
  name: string;
  note: string;
  price: string;
  duration: string;
  masters: string[];
};

const services: Service[] = [
  { id: "color", name: "Окрашивание", note: "Тон в тон, сложные техники и уход", price: "от 2 000 ₽", duration: "от 2 часов", masters: ["Юлия", "Снежана"] },
  { id: "women", name: "Женская стрижка", note: "Форма, укладка и рекомендации по уходу", price: "от 900 ₽", duration: "60–90 минут", masters: ["Юлия", "Снежана"] },
  { id: "men", name: "Мужская стрижка", note: "Классика, современные формы и борода", price: "от 700 ₽", duration: "45–60 минут", masters: ["Юлия", "Снежана"] },
  { id: "manicure", name: "Маникюр", note: "Обработка, покрытие и дизайн", price: "от 1 000 ₽", duration: "от 90 минут", masters: ["Елена"] },
  { id: "pedicure", name: "Педикюр", note: "Комфортный уход и стойкое покрытие", price: "от 1 600 ₽", duration: "от 90 минут", masters: ["Елена"] },
  { id: "brows", name: "Брови и ресницы", note: "Архитектура, окрашивание, ламинирование", price: "от 600 ₽", duration: "от 45 минут", masters: ["Любой свободный мастер"] },
  { id: "depilation", name: "Депиляция", note: "Деликатный профессиональный уход", price: "от 600 ₽", duration: "от 30 минут", masters: ["Любой свободный мастер"] },
  { id: "massage", name: "Массаж", note: "Расслабление и восстановление", price: "по записи", duration: "от 60 минут", masters: ["Елена"] },
];

const times = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:00"];

export default function BookingPage() {
  const [serviceId, setServiceId] = useState(services[0].id);
  const [master, setMaster] = useState(services[0].masters[0]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const selectedService = useMemo(
    () => services.find((service) => service.id === serviceId) ?? services[0],
    [serviceId],
  );
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
  const ready = Boolean(serviceId && master && date && time && name.trim() && phone.trim());

  function selectService(service: Service) {
    setServiceId(service.id);
    setMaster(service.masters[0]);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;

    const formattedDate = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${date}T12:00:00`));
    const message = [
      "Здравствуйте! Хочу записаться в салон «Ассоль».",
      `Услуга: ${selectedService.name}`,
      `Мастер: ${master}`,
      `Желаемые дата и время: ${formattedDate}, ${time}`,
      `Имя: ${name.trim()}`,
      `Телефон: ${phone.trim()}`,
      comment.trim() ? `Комментарий: ${comment.trim()}` : "",
    ].filter(Boolean).join("\n");

    setSubmitted(true);
    window.open(`https://wa.me/79035150818?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="booking-page">
      <header className="booking-header">
        <Link className="brand" href="/" aria-label="Ассоль — на главную">
          <span>Ассоль</span><small>салон красоты</small>
        </Link>
        <Link className="booking-back" href="/">← Вернуться на сайт</Link>
        <a className="header-phone" href="tel:+79035150818">+7 903 515-08-18</a>
      </header>

      <section className="booking-intro">
        <div>
          <p className="eyebrow">Запись в салон</p>
          <h1>Выберите время<br /><em>для себя</em></h1>
        </div>
        <p>Оставьте пожелания — администратор проверит расписание и подтвердит запись в WhatsApp или по телефону.</p>
      </section>

      <form className="booking-layout" onSubmit={submit}>
        <div className="booking-form">
          <fieldset className="booking-step">
            <legend><span>01</span><strong>Услуга</strong><small>Что будем делать?</small></legend>
            <div className="booking-services">
              {services.map((service) => (
                <button
                  className={service.id === serviceId ? "service-choice active" : "service-choice"}
                  type="button"
                  key={service.id}
                  onClick={() => selectService(service)}
                  aria-pressed={service.id === serviceId}
                >
                  <span>{service.name}</span>
                  <small>{service.note}</small>
                  <strong>{service.price}</strong>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="booking-step">
            <legend><span>02</span><strong>Мастер</strong><small>Можно довериться любому свободному</small></legend>
            <div className="choice-row">
              {selectedService.masters.map((item) => (
                <button className={master === item ? "pill-choice active" : "pill-choice"} type="button" key={item} onClick={() => setMaster(item)} aria-pressed={master === item}>{item}</button>
              ))}
              {!selectedService.masters.includes("Любой свободный мастер") && (
                <button className={master === "Любой свободный мастер" ? "pill-choice active" : "pill-choice"} type="button" onClick={() => setMaster("Любой свободный мастер")} aria-pressed={master === "Любой свободный мастер"}>Любой свободный</button>
              )}
            </div>
          </fieldset>

          <fieldset className="booking-step">
            <legend><span>03</span><strong>Дата и время</strong><small>Укажите удобное окно</small></legend>
            <label className="date-field"><span>Желаемая дата</span><input type="date" value={date} min={today} onChange={(event) => setDate(event.target.value)} required /></label>
            <div className="time-grid" aria-label="Желаемое время">
              {times.map((item) => <button className={time === item ? "time-choice active" : "time-choice"} type="button" key={item} onClick={() => setTime(item)} aria-pressed={time === item}>{item}</button>)}
            </div>
            <p className="booking-hint">Выбранное время — пожелание. Администратор подтвердит его или предложит ближайшее свободное.</p>
          </fieldset>

          <fieldset className="booking-step">
            <legend><span>04</span><strong>Ваши контакты</strong><small>Чтобы подтвердить запись</small></legend>
            <div className="contact-fields">
              <label><span>Имя</span><input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Как к вам обращаться" autoComplete="name" required /></label>
              <label><span>Телефон</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+7 999 000-00-00" autoComplete="tel" required /></label>
              <label className="wide"><span>Комментарий <small>необязательно</small></span><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Расскажите о пожеланиях или задайте вопрос" rows={4} /></label>
            </div>
          </fieldset>
        </div>

        <aside className="booking-summary">
          <div className="summary-image"><Image src="/images/gallery-9.webp" alt="Работа мастера салона Ассоль" fill sizes="(max-width: 900px) 100vw, 34vw" /></div>
          <div className="summary-content">
            <p className="eyebrow">Ваша запись</p>
            <h2>{selectedService.name}</h2>
            <dl>
              <div><dt>Мастер</dt><dd>{master}</dd></div>
              <div><dt>Дата</dt><dd>{date ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`)) : "Не выбрана"}</dd></div>
              <div><dt>Время</dt><dd>{time || "Не выбрано"}</dd></div>
              <div><dt>Стоимость</dt><dd>{selectedService.price}</dd></div>
              <div><dt>Длительность</dt><dd>{selectedService.duration}</dd></div>
            </dl>
            <button className="booking-submit" type="submit" disabled={!ready}>Отправить заявку <span>→</span></button>
            <p className="summary-note">Нажимая кнопку, вы переходите в WhatsApp с готовой заявкой. Отправьте сообщение, и мы подтвердим запись.</p>
            {submitted && <p className="booking-success" role="status">Заявка подготовлена — осталось отправить сообщение в WhatsApp.</p>}
          </div>
        </aside>
      </form>

      <footer className="booking-footer"><span>Пушкино · Московский проспект, 44</span><span>Ежедневно · 09:00–20:00</span></footer>
    </main>
  );
}

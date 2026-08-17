"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const works = [
  { src: "/images/portfolio-color-refresh.webp", alt: "Окрашивание волос до и после в салоне Ассоль", label: "Окрашивание · Стрижка", description: "Обновление цвета и формы — результат крупным планом, без ретуши." },
  { src: "/images/clean-women-hair.webp", alt: "Женская стрижка и укладка в салоне Ассоль", label: "Стрижка · Укладка", description: "Мягкие слои и укладка, которая подчёркивает движение волос." },
  { src: "/images/clean-men.webp", alt: "Мужская стрижка в салоне Ассоль", label: "Мужская стрижка", description: "Чистая форма, плавный переход и аккуратная окантовка." },
];

const bookingUrl = "/booking";

export default function PortfolioCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % works.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  const showPrevious = () => setActiveIndex((current) => (current - 1 + works.length) % works.length);
  const showNext = () => setActiveIndex((current) => (current + 1) % works.length);

  return (
    <div
      className="works-carousel"
      aria-roledescription="карусель"
      aria-label="Работы мастеров салона Ассоль"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div className="works-viewport">
        <div className="works-track" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
          {works.map((work, index) => (
            <figure className="work" key={work.src} aria-hidden={index !== activeIndex}>
              <div className="work-media">
                <Image src={work.src} alt={work.alt} width={1080} height={1440} sizes="(max-width: 720px) calc(100vw - 36px), 52vw" priority={index === 0} />
              </div>
              <figcaption>
                <span className="work-kicker">Реальная работа</span>
                <h3>{work.label}</h3>
                <p>{work.description}</p>
                <a className="work-link" href={bookingUrl} tabIndex={index === activeIndex ? 0 : -1}>Записаться на похожий образ <span>↗</span></a>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className="works-controls">
        <div className="works-dots" aria-label="Выбрать работу">
          {works.map((work, index) => (
            <button
              className={index === activeIndex ? "active" : ""}
              type="button"
              key={work.src}
              onClick={() => setActiveIndex(index)}
              aria-label={`Показать: ${work.label}`}
              aria-current={index === activeIndex ? "true" : undefined}
            />
          ))}
        </div>
        <div className="works-arrows">
          <button type="button" onClick={showPrevious} aria-label="Предыдущая работа">←</button>
          <button type="button" onClick={showNext} aria-label="Следующая работа">→</button>
        </div>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { PortfolioWork } from "./site-data-types";

type PortfolioCarouselProps = {
  works: PortfolioWork[];
  bookingUrl: string;
};

export default function PortfolioCarousel({ works, bookingUrl }: PortfolioCarouselProps) {
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
    if (paused || reducedMotion || works.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % works.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, works.length]);

  const showPrevious = () => { if (works.length > 1) setActiveIndex((current) => (current - 1 + works.length) % works.length); };
  const showNext = () => { if (works.length > 1) setActiveIndex((current) => (current + 1) % works.length); };

  if (works.length === 0) {
    return <div className="works-empty" role="status">Скоро здесь появятся новые работы мастеров.</div>;
  }
  const currentIndex = Math.min(activeIndex, works.length - 1);

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
        <div className="works-track" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
          {works.map((work, index) => (
            <figure className="work" key={work.id} aria-hidden={index !== currentIndex}>
              <div className="work-media">
                <Image src={work.src} alt={work.alt} width={1080} height={1440} sizes="(max-width: 720px) calc(100vw - 36px), 52vw" priority={index === 0} />
              </div>
              <figcaption>
                <span className="work-kicker">Реальная работа</span>
                <h3>{work.label}</h3>
                {work.description.trim() ? <p className="work-description">{work.description}</p> : null}
                <a className="work-link" href={bookingUrl} tabIndex={index === currentIndex ? 0 : -1}>Записаться на похожий образ <span>↗</span></a>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className="works-controls">
        <div className="works-dots" aria-label="Выбрать работу">
          {works.map((work, index) => (
            <button
              className={index === currentIndex ? "active" : ""}
              type="button"
              key={work.id}
              onClick={() => setActiveIndex(index)}
              aria-label={`Показать: ${work.label}`}
              aria-current={index === currentIndex ? "true" : undefined}
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

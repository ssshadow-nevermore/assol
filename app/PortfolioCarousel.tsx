"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { shouldBypassImageOptimizer } from "./media-url";
import type { PortfolioWork } from "./site-data-types";
import type { CatalogCategory } from "./services-data";

type PortfolioCategory = Pick<CatalogCategory, "id" | "title" | "shortTitle">;

type PortfolioCarouselProps = {
  works: PortfolioWork[];
  bookingUrl: string;
  categories?: PortfolioCategory[];
};

const PAGE_SIZE = 12;
const INFO_CARD_WIDTH = 320;
const INFO_CARD_HEIGHT = 240;

function belongsToCategory(work: PortfolioWork, category: PortfolioCategory): boolean {
  return work.categoryId === category.id
    || work.categoryLabel === category.title
    || work.categoryLabel === category.shortTitle;
}

function categoryLabel(work: PortfolioWork, categories: PortfolioCategory[]): string {
  if (work.categoryLabel) return work.categoryLabel;
  return categories.find((category) => belongsToCategory(work, category))?.title ?? "Работы салона";
}

export default function PortfolioCarousel({ works, bookingUrl, categories = [] }: PortfolioCarouselProps) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null);
  const [infoPosition, setInfoPosition] = useState({ left: 16, top: 16 });
  const [lightboxWork, setLightboxWork] = useState<PortfolioWork | null>(null);
  const infoCloseTimer = useRef<number | null>(null);

  const filterOptions = useMemo(() => {
    const usedCategories = categories.filter((category) => works.some((work) => belongsToCategory(work, category)));
    return [{ id: "all", label: "Все" }, ...usedCategories.map((category) => ({ id: category.id, label: category.shortTitle || category.title }))];
  }, [categories, works]);

  const filteredWorks = useMemo(() => {
    if (activeCategory === "all") return works;
    const selected = categories.find((category) => category.id === activeCategory);
    return selected ? works.filter((work) => belongsToCategory(work, selected)) : works;
  }, [activeCategory, categories, works]);

  const visibleWorks = filteredWorks.slice(0, visibleCount);
  const activeInfoWork = works.find((work) => work.id === activeInfoId) ?? null;

  useEffect(() => {
    if (!activeInfoId && !lightboxWork) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setActiveInfoId(null);
      setLightboxWork(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeInfoId, lightboxWork]);

  useEffect(() => {
    if (!activeInfoId) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const info = document.getElementById(`portfolio-info-${activeInfoId}`);
      const card = document.querySelector(`[data-portfolio-id="${CSS.escape(activeInfoId)}"]`);
      if (!info?.contains(target) && !card?.contains(target)) setActiveInfoId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [activeInfoId]);

  useEffect(() => {
    if (!lightboxWork) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [lightboxWork]);

  function cancelInfoClose() {
    if (infoCloseTimer.current !== null) window.clearTimeout(infoCloseTimer.current);
    infoCloseTimer.current = null;
  }

  function scheduleInfoClose() {
    cancelInfoClose();
    infoCloseTimer.current = window.setTimeout(() => setActiveInfoId(null), 140);
  }

  function openInfo(work: PortfolioWork, target: HTMLElement) {
    cancelInfoClose();
    const rect = target.getBoundingClientRect();
    const width = Math.min(INFO_CARD_WIDTH, Math.max(260, window.innerWidth - 32));
    if (window.matchMedia("(max-width: 720px)").matches) {
      let top = rect.bottom + 12;
      if (top + INFO_CARD_HEIGHT > window.innerHeight - 16) top = rect.top - INFO_CARD_HEIGHT - 12;
      top = Math.max(16, Math.min(top, window.innerHeight - INFO_CARD_HEIGHT - 16));
      setInfoPosition({ left: 16, top });
      setActiveInfoId(work.id);
      return;
    }
    let left = rect.right + 16;
    if (left + width > window.innerWidth - 16) left = rect.left - width - 16;
    left = Math.max(16, Math.min(left, window.innerWidth - width - 16));
    let top = rect.top;
    if (top + INFO_CARD_HEIGHT > window.innerHeight - 16) top = window.innerHeight - INFO_CARD_HEIGHT - 16;
    top = Math.max(16, top);
    setInfoPosition({ left, top });
    setActiveInfoId(work.id);
  }

  function closeInfo() {
    cancelInfoClose();
    setActiveInfoId(null);
  }

  if (works.length === 0) {
    return <div className="works-empty" role="status">Скоро здесь появятся новые работы мастеров.</div>;
  }

  return (
    <div className="portfolio-gallery">
      <div className="portfolio-filters" role="tablist" aria-label="Фильтр работ по категориям">
        {filterOptions.map((option) => (
          <button
            type="button"
            role="tab"
            key={option.id}
            className={activeCategory === option.id ? "is-active" : ""}
            aria-selected={activeCategory === option.id}
            onClick={() => { setActiveCategory(option.id); setVisibleCount(PAGE_SIZE); setActiveInfoId(null); }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {filteredWorks.length === 0 ? (
        <div className="works-empty" role="status">В этой категории пока нет опубликованных работ.</div>
      ) : (
        <div className="portfolio-grid">
          {visibleWorks.map((work) => (
            <article className="portfolio-card" key={work.id} data-portfolio-id={work.id}>
              <div className="portfolio-card-media-wrap">
                <button
                  type="button"
                  className="portfolio-card-media"
                  aria-label={`Подробнее о работе: ${work.label}`}
                  aria-expanded={activeInfoId === work.id}
                  onPointerEnter={(event) => { if (event.pointerType === "mouse") openInfo(work, event.currentTarget); }}
                  onPointerLeave={(event) => { if (event.pointerType === "mouse" && !window.matchMedia("(max-width: 720px)").matches) scheduleInfoClose(); }}
                  onFocus={(event) => openInfo(work, event.currentTarget)}
                  onBlur={(event) => { if (!window.matchMedia("(max-width: 720px)").matches && !event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) scheduleInfoClose(); }}
                  onClick={(event) => { if (activeInfoId === work.id) closeInfo(); else openInfo(work, event.currentTarget); }}
                >
                  <Image
                    className="portfolio-gallery-image"
                    src={work.src}
                    alt={work.alt}
                    width={1080}
                    height={810}
                    loading="lazy"
                    sizes="(max-width: 720px) calc(50vw - 28px), (max-width: 1100px) 30vw, 18vw"
                    unoptimized={shouldBypassImageOptimizer(work.src)}
                  />
                  <span className="portfolio-card-more">Подробнее</span>
                </button>
                <button type="button" className="portfolio-card-zoom" aria-label={`Открыть фотографию: ${work.label}`} onClick={() => setLightboxWork(work)}>↗</button>
              </div>
              <div className="portfolio-card-caption">
                <span>{categoryLabel(work, categories)}</span>
                <h3>{work.label}</h3>
              </div>
            </article>
          ))}
        </div>
      )}

      {visibleWorks.length < filteredWorks.length && (
        <button type="button" className="portfolio-load-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Показать ещё</button>
      )}

      {activeInfoWork && typeof document !== "undefined" && createPortal(
        <aside
          id={`portfolio-info-${activeInfoWork.id}`}
          className="portfolio-info-card"
          style={{ left: infoPosition.left, top: infoPosition.top }}
          onPointerEnter={cancelInfoClose}
          onPointerLeave={scheduleInfoClose}
        >
          <span className="portfolio-info-kicker">Реальная работа</span>
          <h3>{activeInfoWork.label}</h3>
          <p>{activeInfoWork.description.trim() || "Результат крупным планом — вдохновение для вашего следующего образа."}</p>
          <div className="portfolio-info-actions">
            <button type="button" onClick={() => setLightboxWork(activeInfoWork)}>Открыть фото <span aria-hidden="true">↗</span></button>
            <a href={bookingUrl}>Записаться <span aria-hidden="true">↗</span></a>
          </div>
        </aside>,
        document.body,
      )}

      {lightboxWork && typeof document !== "undefined" && createPortal(
        // The backdrop is a dialog surface; the inner content and close button stay interactive.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div className="portfolio-lightbox" role="dialog" aria-modal="true" aria-label={`Просмотр фотографии: ${lightboxWork.label}`} onClick={(event) => { if (event.target === event.currentTarget) setLightboxWork(null); }} onKeyDown={(event) => { if (event.key === "Escape") setLightboxWork(null); }} tabIndex={-1}>
          <div className="portfolio-lightbox-content">
            <button type="button" className="portfolio-lightbox-close" aria-label="Закрыть просмотр" onClick={() => setLightboxWork(null)}>×</button>
            <Image
              src={lightboxWork.src}
              alt={lightboxWork.alt}
              width={1600}
              height={1200}
              sizes="(max-width: 720px) calc(100vw - 32px), 80vw"
              unoptimized={shouldBypassImageOptimizer(lightboxWork.src)}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

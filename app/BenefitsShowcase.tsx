"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { shouldBypassImageOptimizer } from "./media-url";
import type { SiteOffer } from "./site-data-types";

type FlipCardProps = {
  className: string;
  front: string;
  back: string;
  frontAlt: string;
  backAlt: string;
  label: string;
  enabled?: boolean;
};

function FlipCard({ className, front, back, frontAlt, backAlt, label, enabled = true }: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);
  const canFlip = enabled && Boolean(back);
  // Reset a previously flipped card when its back side is removed or disabled.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!canFlip) setFlipped(false); }, [canFlip]);

  if (!canFlip) {
    return <span className={`flip-card ${className} flip-card--static`}><span className="flip-card-inner"><span className="flip-card-face flip-card-front"><Image src={front} alt={frontAlt} width={1600} height={1200} sizes="(max-width: 720px) calc(100vw - 72px), 38vw" unoptimized={shouldBypassImageOptimizer(front)} /></span></span></span>;
  }

  return (
    <button
      className={`flip-card ${className}${flipped ? " is-flipped" : ""}`}
      type="button"
      aria-pressed={flipped}
      aria-label={`${label}. Нажмите, чтобы ${flipped ? "показать лицевую сторону" : "посмотреть условия"}`}
      onClick={() => setFlipped((value) => !value)}
    >
      <span className="flip-card-inner">
        <span className="flip-card-face flip-card-front">
          <Image src={front} alt={frontAlt} width={1600} height={1200} sizes="(max-width: 720px) calc(100vw - 72px), 38vw" unoptimized={shouldBypassImageOptimizer(front)} />
          <span className="flip-card-hint">Нажмите или наведите, чтобы перевернуть</span>
        </span>
        <span className="flip-card-face flip-card-back">
          <Image src={back} alt={backAlt} width={1600} height={1200} sizes="(max-width: 720px) calc(100vw - 72px), 38vw" unoptimized={shouldBypassImageOptimizer(back)} />
        </span>
      </span>
    </button>
  );
}

type BenefitsShowcaseProps = {
  offers: SiteOffer[];
};

function FeatureOfferCard({ offer }: { offer: SiteOffer }) {
  const isCertificate = offer.type === "certificate";
  const nominalValue = isCertificate
    ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(offer.nominalValue ?? 0).replace(/\u00a0/g, " ")
    : "";
  const conditions = isCertificate
    ? offer.conditions
      .filter((condition) => condition.title?.trim() || condition.description.trim() || condition.textValue?.trim())
      .sort((left, right) => left.sortOrder - right.sortOrder)
    : [];

  return (
    <article className={`benefit-offer benefit-offer--${offer.type}`} data-offer-id={offer.id} data-offer-type={offer.type}>
      <div className="benefit-offer-media">
        <FlipCard
          className={`flip-card--${offer.type}`}
          front={offer.frontUrl}
          back={offer.backUrl}
          frontAlt={isCertificate ? "Лицевая сторона скидочного сертификата салона Ассоль" : "Лицевая сторона акционной карточки салона Ассоль"}
          backAlt={isCertificate ? "Обратная сторона сертификата со списком скидок" : "Обратная сторона карточки: условия акции"}
          label={isCertificate ? "Скидочный сертификат Ассоль" : offer.title}
          enabled={offer.flipEnabled}
        />
      </div>
      <div className="benefit-offer-copy">
        <span className="benefit-kicker">{isCertificate ? `До ${nominalValue} ₽ выгоды` : offer.eyebrow}</span>
        <h3>{titleWithBreak(isCertificate ? (offer.eyebrow ?? offer.title) : offer.title, isCertificate ? "или купите" : "стрижка")}</h3>
        <p>{offer.description}</p>
        {isCertificate ? (
          conditions.length > 0 && <ul className="certificate-use-cases">
            {conditions.map((condition) => (
              <li key={condition.id}>
                {condition.title && <strong>{condition.title}</strong>}
                <span>{condition.description || condition.textValue}</span>
              </li>
            ))}
          </ul>
        ) : <strong>{offer.rules.length} услуги участвуют</strong>}
      </div>
    </article>
  );
}

function titleWithBreak(title: string, breakBefore: string) {
  const index = title.indexOf(breakBefore);
  if (index <= 0) return title;
  return <>{title.slice(0, index)}<br />{title.slice(index)}</>;
}

function OfferCarousel({ offers }: { offers: SiteOffer[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || offers.length < 2) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % offers.length), 6500);
    return () => window.clearInterval(timer);
  }, [offers.length, paused]);
  if (!offers.length) return null;
  const currentIndex = Math.min(index, offers.length - 1);
  return (
    <div className="benefit-extra-carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
      <div className="benefit-extra-carousel-head">
        <div><span className="benefit-kicker">Ещё выгоднее</span><h3>Акции и предложения</h3></div>
        {offers.length > 1 && <div className="benefit-carousel-controls"><button type="button" aria-label="Предыдущая акция" onClick={() => setIndex((value) => (value - 1 + offers.length) % offers.length)}>←</button><span>{currentIndex + 1} / {offers.length}</span><button type="button" aria-label="Следующая акция" onClick={() => setIndex((value) => (value + 1) % offers.length)}>→</button></div>}
      </div>
      <div className="benefit-extra-track" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
        {offers.map((offer) => <div className={`benefit-offer-slide benefit-offer-slide--${offer.type}`} key={offer.id}>
          {offer.type === "loyalty" || offer.type === "certificate" ? <FeatureOfferCard offer={offer} /> : <article className="benefit-extra-card">
            {offer.frontUrl && (offer.flipEnabled && offer.backUrl ? <FlipCard className="flip-card--extra" front={offer.frontUrl} back={offer.backUrl} frontAlt={offer.title} backAlt={`${offer.title}: условия`} label={offer.title} enabled /> : <Image src={offer.frontUrl} alt={offer.title} width={1200} height={800} sizes="(max-width: 720px) calc(100vw - 36px), 46vw" unoptimized={shouldBypassImageOptimizer(offer.frontUrl)} />)}
            <div><span className="benefit-kicker">{offer.shortTitle || offer.eyebrow || "Предложение"}</span><h4>{offer.title}</h4><p>{offer.description}</p><strong>{offer.eyebrow || "Уточните условия у администратора"}</strong></div>
          </article>}
        </div>)}
      </div>
    </div>
  );
}

export default function BenefitsShowcase({ offers }: BenefitsShowcaseProps) {
  const loyaltyOffers = offers.filter((offer) => offer.type === "loyalty");
  const certificateOffers = offers.filter((offer) => offer.type === "certificate");
  const loyalty = loyaltyOffers[0];
  const certificate = certificateOffers[0];
  const featureOffers = [...loyaltyOffers, ...certificateOffers];
  const allOffers = [...featureOffers, ...offers.filter((offer) => offer.type !== "loyalty" && offer.type !== "certificate")];
  if (!allOffers.length) return null;

  return (
    <section className="benefits-showcase" aria-labelledby="benefits-title">
      <div className="benefits-heading">
        <div>
          <p className="eyebrow">Выгодно возвращаться</p>
          <h2 id="benefits-title">Забота, которая<br /><em>остаётся с вами</em></h2>
        </div>
        <p>{loyalty && certificate && loyalty.canCombine && certificate.canCombine ? "Совмещайте программы, получайте больше преимуществ и возвращайтесь за любимыми процедурами с особым удовольствием." : "Выбирайте выгодные предложения и возвращайтесь за любимыми процедурами с особым удовольствием."}</p>
      </div>

      <OfferCarousel offers={allOffers} />
    </section>
  );
}

"use client";

import Image from "next/image";
import { CSSProperties, RefObject, useCallback, useEffect, useRef, useState } from "react";

const BOOKING_URL = "https://yandex.ru/web-maps/webview?mode=booking&booking[permalink]=1089857323&booking[standalone]=true&source=partner-cta";
const HERO_IMAGE = "/images/gallery-9.webp";
const SECTION2_IMAGE = "/images/gallery-4.webp";

const featureBars = ["Стрижки и окрашивание", "Ногтевой сервис", "Брови и уход"];
const services = [
  { name: "Окрашивание\nволос", num: "01", active: true, price: "от 2 000 ₽" },
  { name: "Женские\nстрижки", num: "02", active: false, price: "от 900 ₽" },
  { name: "Маникюр и\nпедикюр", num: "03", active: false, price: "от 1 000 ₽" },
  { name: "Брови и\nресницы", num: "04", active: false, price: "от 600 ₽" },
];
const structuredData = {
  "@context": "https://schema.org",
  "@type": "BeautySalon",
  name: "Салон красоты Ассоль",
  telephone: "+79035150818",
  priceRange: "₽₽",
  address: { "@type": "PostalAddress", streetAddress: "Московский проспект, 44", addressLocality: "Пушкино", addressRegion: "Московская область", addressCountry: "RU" },
  aggregateRating: { "@type": "AggregateRating", ratingValue: "4.6", reviewCount: "54" },
};

type MaskPosition = { x: number; y: number; sw: number; sh: number };

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return mobile;
}

function useMaskPositions(sectionRef: RefObject<HTMLElement | null>, cardRefs: RefObject<(HTMLElement | null)[]>, count: number) {
  const [positions, setPositions] = useState<MaskPosition[]>(Array.from({ length: count }, () => ({ x: 0, y: 0, sw: 1, sh: 1 })));
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const measure = () => {
      const sectionBox = section.getBoundingClientRect();
      setPositions(Array.from({ length: count }, (_, index) => {
        const card = cardRefs.current[index];
        if (!card) return { x: 0, y: 0, sw: sectionBox.width, sh: sectionBox.height };
        const box = card.getBoundingClientRect();
        return { x: box.left - sectionBox.left, y: box.top - sectionBox.top, sw: sectionBox.width, sh: sectionBox.height };
      }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    measure();
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [sectionRef, cardRefs, count]);
  return positions;
}

function useImageWidth(src: string, sectionRef: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const image = new window.Image();
    const update = () => {
      if (!image.naturalHeight || !sectionRef.current) return;
      setWidth(image.naturalWidth * (sectionRef.current.getBoundingClientRect().height / image.naturalHeight));
    };
    image.onload = update;
    image.src = src;
    const observer = new ResizeObserver(update);
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [src, sectionRef]);
  return width;
}

function useStaggeredReveal(containerRef: RefObject<HTMLElement | null>, threshold = 0.15) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold });
    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef, threshold]);
  const getAnimStyle = (index: number): CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(24px)",
    transition: `opacity .6s cubic-bezier(.16,1,.3,1) ${index * 120}ms, transform .6s cubic-bezier(.16,1,.3,1) ${index * 120}ms`,
  });
  return { getAnimStyle };
}

function MaskedCard({ bgImage, position, imageWidth, focalX, className, children, cardRef, style }: {
  bgImage: string; position: MaskPosition; imageWidth: number; focalX: number; className: string; children: React.ReactNode; cardRef: (node: HTMLDivElement | null) => void; style?: CSSProperties;
}) {
  const overflow = imageWidth > position.sw ? imageWidth - position.sw : 0;
  const focalOffset = overflow * focalX;
  return <div ref={cardRef} className={className} style={{ backgroundImage: `url(${bgImage})`, backgroundSize: imageWidth ? `auto ${position.sh}px` : "cover", backgroundPosition: `${-(position.x + focalOffset)}px ${-position.y}px`, backgroundRepeat: "no-repeat", ...style }}>{children}</div>;
}

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [count, setCount] = useState(0);
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    const started = performance.now();
    const timer = window.setInterval(() => {
      const next = Math.min(100, Math.floor((performance.now() - started) / 20));
      setCount(next);
      if (next >= 100) {
        window.clearInterval(timer);
        window.setTimeout(() => setExiting(true), 200);
        window.setTimeout(onComplete, 900);
      }
    }, 20);
    return () => window.clearInterval(timer);
  }, [onComplete]);
  return <div className={`splash ${exiting ? "splash-exit" : ""}`}><strong>{count}</strong></div>;
}

function Navbar() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  const links = [["Главная", "#home"], ["Услуги", "#services"], ["Работы", "#gallery"], ["О салоне", "#about"], ["Контакты", "#contact"]];
  return <>
    <header className="nav-shell">
      <a className="stacked-logo" href="#home"><b>Ассоль</b><b>Красота</b><small>салон в Пушкино</small></a>
      <div className="nav-actions"><a className="menu-pill" href="#services">Меню</a><a href="tel:+79035150818">+7 903 515-08-18</a></div>
      <button className={`hamburger ${open ? "is-open" : ""}`} onClick={() => setOpen(!open)} aria-label={open ? "Закрыть меню" : "Открыть меню"} aria-expanded={open}><span /><span /><span /></button>
    </header>
    <div className={`mobile-menu ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button className="menu-backdrop" onClick={() => setOpen(false)} aria-label="Закрыть меню" />
      <div className="menu-panel">
        <nav>{links.map(([label, href], i) => <a key={href} href={href} onClick={() => setOpen(false)} style={{ transitionDelay: open ? `${100 + i * 60}ms` : "0ms" }}>{label}</a>)}</nav>
        <div className="menu-book"><p>Ежедневно · 09:00–20:00</p><a href={BOOKING_URL}>Записаться онлайн</a></div>
      </div>
    </div>
  </>;
}

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const isMobile = useIsMobile();
  const section1Ref = useRef<HTMLElement | null>(null);
  const section2Ref = useRef<HTMLElement | null>(null);
  const section3Ref = useRef<HTMLElement | null>(null);
  const s1Cards = useRef<(HTMLElement | null)[]>([]);
  const s2Cards = useRef<(HTMLElement | null)[]>([]);
  const s1Reveal = useStaggeredReveal(section1Ref, 0.05);
  const s2Reveal = useStaggeredReveal(section2Ref);
  const s3Reveal = useStaggeredReveal(section3Ref);
  const s1Positions = useMaskPositions(section1Ref, s1Cards, 4);
  const s2Positions = useMaskPositions(section2Ref, s2Cards, 4);
  const s1ImageWidth = useImageWidth(HERO_IMAGE, section1Ref);
  const s2ImageWidth = useImageWidth(SECTION2_IMAGE, section2Ref);
  const finishSplash = useCallback(() => setShowSplash(false), []);

  return <div className="site-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    {showSplash && <SplashScreen onComplete={finishSplash} />}
    <Navbar />

    <section id="home" ref={section1Ref} className="mosaic-section hero-mosaic">
      <div className="feature-bars">
        {featureBars.map((label, index) => <MaskedCard key={label} bgImage={HERO_IMAGE} position={s1Positions[index]} imageWidth={s1ImageWidth} focalX={isMobile ? .7 : .8} className="feature-card" cardRef={(node) => { s1Cards.current[index] = node; }} style={s1Reveal.getAnimStyle(index)}><span>{label}</span></MaskedCard>)}
      </div>
      <MaskedCard bgImage={HERO_IMAGE} position={s1Positions[3]} imageWidth={s1ImageWidth} focalX={isMobile ? .7 : .8} className="main-hero-card" cardRef={(node) => { s1Cards.current[3] = node; }} style={s1Reveal.getAnimStyle(3)}>
        <p className="hero-intro">Профессиональная забота о красоте<br />в самом сердце Пушкино</p>
        <div className="hero-title"><span>Салон красоты · Московский проспект, 44</span><h1>Ассоль<br />Beauty</h1></div>
        <a className="hero-free" href={BOOKING_URL}>Записаться онлайн</a>
      </MaskedCard>
    </section>

    <section id="services" ref={section2Ref} className="mosaic-section services-mosaic">
      <div className="services-grid">
        <MaskedCard bgImage={SECTION2_IMAGE} position={s2Positions[0]} imageWidth={s2ImageWidth} focalX={isMobile ? .65 : .8} className="service-image-card gallery-title-card" cardRef={(node) => { s2Cards.current[0] = node; }} style={s2Reveal.getAnimStyle(0)}><h2>Красота в деталях</h2><p>Реальные работы наших мастеров</p></MaskedCard>
        <MaskedCard bgImage={SECTION2_IMAGE} position={s2Positions[1]} imageWidth={s2ImageWidth} focalX={isMobile ? .65 : .8} className="service-image-card consultation-image-card" cardRef={(node) => { s2Cards.current[1] = node; }} style={s2Reveal.getAnimStyle(1)}><p>Подберём форму, оттенок и уход,<br />которые подходят именно вам.</p><a href="tel:+79035150818">Позвонить</a></MaskedCard>
        <MaskedCard bgImage={SECTION2_IMAGE} position={s2Positions[2]} imageWidth={s2ImageWidth} focalX={isMobile ? .65 : .8} className="service-image-card makeover-card" cardRef={(node) => { s2Cards.current[2] = node; }} style={s2Reveal.getAnimStyle(2)}><h2>Ваш новый<br />образ</h2></MaskedCard>
        <MaskedCard bgImage={SECTION2_IMAGE} position={s2Positions[3]} imageWidth={s2ImageWidth} focalX={isMobile ? .65 : .8} className="service-image-card service-catalog-card" cardRef={(node) => { s2Cards.current[3] = node; }} style={s2Reveal.getAnimStyle(3)}>
          <div className="service-catalog">{services.map((service) => <a key={service.num} href={BOOKING_URL} className={service.active ? "active" : ""}><h3>{service.name}</h3><p>{service.price}</p><span>{service.num}</span></a>)}</div>
        </MaskedCard>
      </div>
    </section>

    <section id="gallery" ref={section3Ref} className="mosaic-section about-mosaic">
      <div className="about-grid">
        <div className="about-left">
          <div id="about" className="about-heading-card" style={s3Reveal.getAnimStyle(0)}><h2>Мастера<br />рядом</h2><p>Внимательно слышим ваши пожелания</p></div>
          <div className="about-pair" style={s3Reveal.getAnimStyle(1)}><div><Image src="/images/gallery-5.webp" alt="Мужская стрижка до и после" fill sizes="25vw" /></div><div><Image src="/images/gallery-10.webp" alt="Женская стрижка и укладка" fill sizes="25vw" /></div></div>
          <div className="booking-card" style={s3Reveal.getAnimStyle(2)}><div><p>Онлайн-запись</p><h3>Выберите<br />услугу и удобное<br />время</h3></div><a href={BOOKING_URL}>Записаться</a></div>
        </div>
        <div id="contact" className="about-main-image" style={s3Reveal.getAnimStyle(3)}><Image src="/images/gallery-9.webp" alt="Результат окрашивания в салоне Ассоль" fill priority sizes="(max-width: 767px) 100vw, 50vw" />
          <div className="about-overlays"><div className="overlay-white"><h4>Юлия<br />Снежана<br />Елена</h4><a href={BOOKING_URL}>↗</a></div><div className="overlay-glass"><h4>Пушкино<br />Московский<br />проспект, 44</h4><a href="https://yandex.ru/maps/org/1089857323">↗</a></div></div>
        </div>
      </div>
    </section>
  </div>;
}

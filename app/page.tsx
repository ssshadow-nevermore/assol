import Image from "next/image";
import AwardVideo from "./AwardVideo";
import BenefitsShowcase from "./BenefitsShowcase";
import FooterContacts from "./FooterContacts";
import PortfolioCarousel from "./PortfolioCarousel";
import ServiceBenefitPrice from "./ServiceBenefitPrice";
import { getSiteData } from "./site-data";

// Team photos can come from either a legacy /images path or Object Storage
// /media route, so they intentionally remain plain responsive img elements.
/* eslint-disable @next/next/no-img-element */

// Site content is edited in SQLite from /admin. Keep this route request-driven so
// a newly saved service/offer is visible publicly without a redeploy or server
// restart.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MARQUEE_DIRECTIONS = ["СТРИЖКИ", "ОКРАШИВАНИЕ", "МАНИКЮР", "БРОВИ", "УХОД"];

function MarqueeSequence({ hidden = false }: { hidden?: boolean }) {
  return (
    <span className="marquee-sequence" aria-hidden={hidden || undefined}>
      {MARQUEE_DIRECTIONS.map((direction) => (
        <span className="marquee-item" key={direction}>
          <i aria-hidden="true">✦</i><b>{direction}</b>
        </span>
      ))}
    </span>
  );
}

export default async function Home() {
  const siteData = await getSiteData();
  const { categories, salon, links, offers, portfolio, blocks, masters } = siteData;
  const bookingUrl = links.dikidi_widget.url;
  const phoneUrl = links.phone.url;
  const reviewUrl = links.yandex_reviews.url;
  const vkUrl = links.vk.url;
  const extraContactLinks = Object.values(links).filter((link) => link.kind === "other" && link.key !== "phone").map((link) => ({ label: link.label, url: link.url, openInNewTab: link.openInNewTab }));
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: salon.name,
    image: new URL(salon.logoUrl, "https://assol-salon.ru").href,
    telephone: salon.phone,
    priceRange: "₽₽",
    address: {
      "@type": "PostalAddress",
      streetAddress: salon.streetAddress,
      addressLocality: salon.city,
      addressRegion: salon.region,
      addressCountry: "RU",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <header className="header">
        <a className="brand" href="#top" aria-label="Ассоль — на главную">
          <Image className="brand-logo" src={salon.logoUrl} alt={salon.name} width={1159} height={235} priority />
        </a>
        <nav aria-label="Главная навигация">
          <a href="#services">Услуги</a><a href="#works">Работы</a><a href="#team">Мастера</a><a href="#contacts">Контакты</a>
        </nav>
        <a className="header-phone" href={phoneUrl}>{salon.displayPhone}</a>
        <a className="button button-small" href={bookingUrl}>Записаться</a>
      </header>

      <main id="top" data-content-source={siteData.source}>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Салон красоты в {salon.city}</p>
            <h1>Красота, в которой<br /><em>вы — это вы</em></h1>
            <p className="hero-lead">Стрижки, окрашивание любой сложности, ногтевой сервис и уход рядом с домом. Подберём образ, который подходит вашему ритму и настроению.</p>
            <div className="hero-actions">
              <a className="button" href={bookingUrl}>Записаться онлайн <span>↗</span></a>
              <a className="text-link" href={phoneUrl}>Позвонить</a>
            </div>
            <a className="hero-proof" href={reviewUrl} target="_blank" rel="noreferrer"><span className="stars">★★★★★</span><span>Актуальные отзывы на Яндекс Картах</span><strong>↗</strong></a>
          </div>
          <div className="hero-visual" aria-label="Результат работы мастера салона">
            <Image src="/images/hero-bob.webp" alt="Женская стрижка боб, выполненная мастером салона Ассоль" width={1200} height={1200} priority sizes="(max-width: 720px) calc(100vw - 36px), 48vw" />
            <div className="hero-note"><p>Бережно к волосам.<br />Точно к вашему образу.</p></div>
          </div>
          <p className="hero-address">{salon.city} · {salon.streetAddress}</p>
        </section>

        <section className="marquee" aria-label="Направления салона"><div className="marquee-track"><MarqueeSequence /><MarqueeSequence hidden /></div></section>

        <section className="section services" id="services">
          <BenefitsShowcase offers={offers} />
          <div className="section-heading"><div><p className="eyebrow">Полный прайс</p><h2>Все услуги<br /><em>в одном месте</em></h2></div><p>Выберите направление и найдите процедуру, которая подчеркнёт вашу красоту и подарит ощущение обновления.</p></div>
          <div className="service-catalog">
            {categories.map((category, index) => (
              <details className="service-category" key={category.id} open={index === 0}>
                <summary>
                  <span className="service-category-title"><strong>{category.title}</strong><small>{category.description}</small></span>
                  <span className="service-category-price">{category.priceFrom}</span>
                  <span className="service-toggle" aria-hidden="true">+</span>
                </summary>
                <div className="service-category-body">
                  {category.priceNote && <p className="service-category-note">{category.priceNote}</p>}
                  <div className="service-price-grid">
                    {category.items.map((item) => (
                      <article className="service-price-item" key={item.id}>
                        <div><h3>{item.name}</h3>{item.note && <p>{item.note}</p>}</div>
                        <div className="service-price-meta">{item.duration && <small>{item.duration}</small>}<ServiceBenefitPrice price={item.price} loyaltyEligible={item.loyaltyEligible} certificateDiscount={item.certificateDiscount} promotionLabel={item.promotionLabel} promotionPriceText={item.promotionPriceText} benefits={item.benefits} /></div>
                      </article>
                    ))}
                  </div>
                  <a className="service-book-link" href={bookingUrl}>Выбрать услугу и мастера <span>↗</span></a>
                </div>
              </details>
            ))}
          </div>
          <p className="price-note">Итоговая стоимость окрашивания зависит от длины и густоты волос, сложности работы и расхода красителя. Мастер подтвердит цену до начала процедуры.</p>
        </section>

        <section className="section works" id="works">
          <div className="section-heading light"><div><p className="eyebrow">Портфолио</p><h2>Результат говорит<br /><em>сам за себя</em></h2></div><p>Реальные работы мастеров «Ассоль». Листайте, вдохновляйтесь и сохраняйте идеи к визиту.</p></div>
          <PortfolioCarousel works={portfolio} bookingUrl={bookingUrl} />
          <a className="button button-light" href={vkUrl}>Больше работ во ВКонтакте <span>↗</span></a>
        </section>

        <section className="section team" id="team">
          <div className="section-heading"><div><p className="eyebrow">Команда</p><h2>Мастера, которым<br /><em>доверяют красоту</em></h2></div><p>Каждый мастер работает в своём направлении и внимательно слышит пожелания клиента.</p></div>
          <div className="team-grid">
            {masters.map((master) => <article key={master.id}>
              {master.imageUrl ? <img className="team-avatar" src={master.imageUrl} alt={master.name} /> : <span>{master.name.trim().charAt(0) || "М"}</span>}
              <div><h3>{master.name}</h3><p>{master.specialization}</p><small>{master.servicesText}</small></div>
            </article>)}
          </div>
        </section>

        <section className="section reviews" id="reviews">
          <div className="section-heading reviews-heading"><div><p className="eyebrow">Нас выбирают</p><h2>Доверие видно<br /><em>в настоящих историях</em></h2></div><p>Узнайте, за что гости выбирают «Ассоль», и найдите своего мастера в их искренних историях.</p></div>
          <div className="social-proof-grid">
            <article className="award-card">
              <div className="award-video-wrap">
                <AwardVideo src={blocks.award.videoUrl} />
              </div>
              <div className="award-copy"><span>{blocks.award.eyebrow}</span><h3>{blocks.award.title}</h3><p>{blocks.award.description}</p><a className="text-link" href={reviewUrl} target="_blank" rel="noreferrer">Посмотреть на Яндекс Картах</a></div>
            </article>
            <div className="yandex-reviews">
              <iframe title="Отзывы о салоне Ассоль на Яндекс Картах" src={links.yandex_reviews_widget.url} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              <a href={reviewUrl} target="_blank" rel="noreferrer">Все отзывы о салоне «Ассоль» на Яндекс Картах</a>
            </div>
          </div>
        </section>

        <section className="section atmosphere">
          <div className="atmosphere-photo"><Image src={blocks.atmosphere.imageUrl} alt="Интерьер салона красоты Ассоль" width={1080} height={1440} sizes="(max-width: 720px) calc(100vw - 36px), 46vw" /></div>
          <div className="atmosphere-copy"><p className="eyebrow">В салоне</p><h2>Спокойно.<br /><em>Уютно. По-настоящему.</em></h2><p>Мы рядом, нас легко найти, а внутри есть всё, чтобы вы отдохнули и доверили заботу о себе профессионалам.</p><ul><li>Оплата картой</li><li>Парковка рядом</li><li>Wi-Fi</li><li>Доступная среда</li></ul></div>
        </section>

        <section className="contacts" id="contacts">
          <div className="contacts-copy"><p className="eyebrow">Контакты</p><h2>Будем рады<br /><em>видеть вас</em></h2><address>{salon.region}, {salon.city}<br />{salon.streetAddress}</address><a className="contact-phone" href={phoneUrl}>{salon.displayPhone}</a><p className="hours">{siteData.hoursLabel}</p><div className="contact-actions"><a className="button" href={bookingUrl}>Записаться онлайн <span>↗</span></a><a className="text-link" href={links.yandex_maps.url}>Построить маршрут</a></div></div>
          <div className="contacts-map" aria-label="Интерактивная карта с расположением салона красоты Ассоль">
            <iframe className="map-frame-desktop" title="Ассоль на Яндекс Картах" src={links.yandex_map_widget_desktop.url} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
            <iframe className="map-frame-mobile" title="Ассоль на Яндекс Картах — мобильная версия" src={links.yandex_map_widget_mobile.url} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
          </div>
        </section>
      </main>

      <footer className="footer"><a className="brand brand-footer" href="#top"><span>Ассоль</span><small>салон красоты</small></a><FooterContacts maxUrl={links.max.url} maxPhone={links.max.phoneToCopy ?? salon.displayPhone} emailUrl={links.email.url} vkUrl={vkUrl} extraLinks={extraContactLinks} /><p>© {new Date().getFullYear()} Ассоль</p></footer>
      <a className="mobile-book" href={bookingUrl}>Записаться онлайн <span>↗</span></a>
    </>
  );
}

import Image from "next/image";
import { catalogCategories } from "./services-data";
import PortfolioCarousel from "./PortfolioCarousel";

const bookingUrl = "/booking";

const reviews = [
  { name: "Ольга", text: "Отличный мастер! Спасибо за стрижку и приятное общение! ❤️" },
  { name: "Ирина К.", text: "От всей души благодарю мастера Снежану за прекрасную причёску. Получилось великолепно!" },
  { name: "Мария", text: "Прекрасные мастера, место хорошее. Возвращаюсь с удовольствием." },
];

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: "Салон красоты Ассоль",
    image: "https://assol-moskovskij-prospekt.clients.site/",
    telephone: "+79035150818",
    priceRange: "₽₽",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Московский проспект, 44",
      addressLocality: "Пушкино",
      addressRegion: "Московская область",
      addressCountry: "RU",
    },
    aggregateRating: { "@type": "AggregateRating", ratingValue: "4.6", reviewCount: "54" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <header className="header">
        <a className="brand" href="#top" aria-label="Ассоль — на главную">
          <span>Ассоль</span><small>салон красоты</small>
        </a>
        <nav aria-label="Главная навигация">
          <a href="#services">Услуги</a><a href="#works">Работы</a><a href="#team">Мастера</a><a href="#contacts">Контакты</a>
        </nav>
        <a className="header-phone" href="tel:+79035150818">+7 903 515-08-18</a>
        <a className="button button-small" href={bookingUrl}>Записаться</a>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Салон красоты в Пушкино</p>
            <h1>Красота, в которой<br /><em>вы — это вы</em></h1>
            <p className="hero-lead">Стрижки, окрашивание, ногтевой сервис и уход рядом с домом. Подберём образ, который подходит вашему ритму и настроению.</p>
            <div className="hero-actions">
              <a className="button" href={bookingUrl}>Записаться онлайн <span>↗</span></a>
              <a className="text-link" href="tel:+79035150818">Позвонить</a>
            </div>
            <div className="hero-proof"><strong>4,6</strong><span className="stars">★★★★★</span><span>54 отзыва на Яндекс Картах</span></div>
          </div>
          <div className="hero-visual" aria-label="Результат работы мастера салона">
            <Image src="/images/hero-bob.webp" alt="Женская стрижка боб, выполненная мастером салона Ассоль" width={1200} height={1200} priority sizes="(max-width: 720px) calc(100vw - 36px), 48vw" />
            <div className="hero-note"><p>Бережно к волосам.<br />Точно к вашему образу.</p></div>
          </div>
          <p className="hero-address">Пушкино · Московский проспект, 44</p>
        </section>

        <section className="marquee" aria-label="Направления салона"><div>СТРИЖКИ <i>✦</i> ОКРАШИВАНИЕ <i>✦</i> МАНИКЮР <i>✦</i> БРОВИ <i>✦</i> УХОД</div></section>

        <section className="section services" id="services">
          <div className="section-heading"><div><p className="eyebrow">Полный прайс</p><h2>Все услуги<br /><em>в одном месте</em></h2></div><p>Мы перенесли подробный актуальный прайс. Откройте нужное направление, чтобы посмотреть процедуры и стоимость.</p></div>
          <div className="service-catalog">
            {catalogCategories.map((category, index) => (
              <details className="service-category" key={category.id} open={index === 0}>
                <summary>
                  <span className="service-number">{category.number}</span>
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
                        <div className="service-price-meta">{item.duration && <small>{item.duration}</small>}<strong>{item.price}</strong></div>
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
          <PortfolioCarousel />
          <a className="button button-light" href="https://vk.ru/assol_krasota">Больше работ во ВКонтакте <span>↗</span></a>
        </section>

        <section className="section team" id="team">
          <div className="section-heading"><div><p className="eyebrow">Команда</p><h2>Мастера, которым<br /><em>доверяют красоту</em></h2></div><p>Каждый мастер работает в своём направлении и внимательно слышит пожелания клиента.</p></div>
          <div className="team-grid">
            <article><span>Д</span><div><h3>Джулия</h3><p>Парикмахер-универсал</p><small>Стрижки · окрашивание · брови</small></div></article>
            <article><span>М</span><div><h3>Марина</h3><p>Мастер депиляции</p><small>Депиляция лица и тела</small></div></article>
            <article><span>С</span><div><h3>Снежана</h3><p>Парикмахер-универсал</p><small>Стрижки · окрашивание · биозавивка</small></div></article>
            <article><span>Ю</span><div><h3>Юлия</h3><p>Парикмахер-универсал, колорист</p><small>Стрижки · окрашивание · депиляция</small></div></article>
            <article><span>Е</span><div><h3>Елена</h3><p>Мастер ногтевого сервиса</p><small>Маникюр · педикюр · покрытие</small></div></article>
          </div>
        </section>

        <section className="section reviews">
          <div className="review-score"><p className="eyebrow">Отзывы</p><strong>4,6</strong><span className="stars">★★★★★</span><p>На основе 54 отзывов<br />на Яндекс Картах</p></div>
          <div className="review-cards">
            {reviews.map((review) => <blockquote key={review.name}><span className="stars">★★★★★</span><p>«{review.text}»</p><footer>{review.name}</footer></blockquote>)}
          </div>
        </section>

        <section className="section atmosphere">
          <div className="atmosphere-photo"><Image src="/images/salon-interior-clean.webp" alt="Интерьер салона красоты Ассоль" width={1080} height={1440} sizes="(max-width: 720px) 100vw, 46vw" /></div>
          <div className="atmosphere-copy"><p className="eyebrow">В салоне</p><h2>Спокойно.<br /><em>Уютно. По-настоящему.</em></h2><p>Мы рядом, нас легко найти, а внутри есть всё, чтобы вы отдохнули и доверили заботу о себе профессионалам.</p><ul><li>Оплата картой</li><li>Парковка рядом</li><li>Wi-Fi</li><li>Доступная среда</li></ul></div>
        </section>

        <section className="contacts" id="contacts">
          <div className="contacts-copy"><p className="eyebrow">Контакты</p><h2>Будем рады<br /><em>видеть вас</em></h2><address>Московская область, Пушкино<br />Московский проспект, 44</address><a className="contact-phone" href="tel:+79035150818">+7 903 515-08-18</a><p className="hours">Ежедневно · 09:00–20:00</p><div className="contact-actions"><a className="button" href={bookingUrl}>Записаться онлайн <span>↗</span></a><a className="text-link" href="https://yandex.ru/maps/org/1089857323">Построить маршрут</a></div></div>
          <div className="contacts-map" aria-label="Интерактивная карта с расположением салона красоты Ассоль"><iframe title="Ассоль на Яндекс Картах" src="https://yandex.ru/map-widget/v1/?mode=search&oid=1089857323&ol=biz&z=16" loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" /></div>
        </section>
      </main>

      <footer className="footer"><a className="brand brand-footer" href="#top"><span>Ассоль</span><small>салон красоты</small></a><div><a href="https://wa.me/79035150818">WhatsApp</a><a href="https://telegram.me/+79035150818">Telegram</a><a href="https://vk.ru/assol_krasota">ВКонтакте</a></div><p>© {new Date().getFullYear()} Ассоль</p></footer>
      <a className="mobile-book" href={bookingUrl}>Записаться онлайн <span>↗</span></a>
    </>
  );
}

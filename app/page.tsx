import Image from "next/image";

const bookingUrl = "/booking";

const services = [
  { number: "01", title: "Окрашивание", text: "Тон в тон, сложные техники и бережный уход", price: "от 2 000 ₽" },
  { number: "02", title: "Женские стрижки", text: "Форма, которая легко укладывается каждый день", price: "от 900 ₽" },
  { number: "03", title: "Мужские стрижки", text: "Классика, современные формы и оформление бороды", price: "от 700 ₽" },
  { number: "04", title: "Маникюр", text: "Аккуратная обработка и стойкое покрытие", price: "от 1 000 ₽" },
  { number: "05", title: "Педикюр", text: "Комфортный уход и безупречный результат", price: "от 1 600 ₽" },
  { number: "06", title: "Брови и ресницы", text: "Архитектура, окрашивание и ламинирование", price: "от 600 ₽" },
  { number: "07", title: "Депиляция", text: "Гладкость и деликатный профессиональный уход", price: "от 600 ₽" },
  { number: "08", title: "Массаж", text: "Расслабляющие сеансы для лёгкости и восстановления", price: "по записи" },
];

const works = [
  { src: "/images/gallery-9.webp", alt: "Окрашивание и женская стрижка в салоне Ассоль", label: "Окрашивание · Стрижка" },
  { src: "/images/gallery-10.webp", alt: "Женская стрижка и укладка в салоне Ассоль", label: "Стрижка · Укладка" },
  { src: "/images/gallery-5.webp", alt: "Мужская стрижка до и после в салоне Ассоль", label: "Мужская стрижка" },
];

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
            <Image src="/images/gallery-9.webp" alt="Результат окрашивания волос в салоне Ассоль" fill priority sizes="(max-width: 720px) 88vw, 34vw" />
            <div className="hero-note"><span>01</span><p>Бережно к волосам.<br />Точно к вашему образу.</p></div>
          </div>
          <p className="hero-address">Пушкино · Московский проспект, 44</p>
        </section>

        <section className="marquee" aria-label="Направления салона"><div>СТРИЖКИ <i>✦</i> ОКРАШИВАНИЕ <i>✦</i> МАНИКЮР <i>✦</i> БРОВИ <i>✦</i> УХОД</div></section>

        <section className="section services" id="services">
          <div className="section-heading"><div><p className="eyebrow">Услуги и цены</p><h2>Всё для вашего<br /><em>образа и настроения</em></h2></div><p>Прозрачные ориентиры по стоимости. Точную цену мастер назовёт после короткой консультации.</p></div>
          <div className="service-list">
            {services.map((item) => <article className="service-row" key={item.number}><span className="service-number">{item.number}</span><h3>{item.title}</h3><p>{item.text}</p><strong>{item.price}</strong><a href={bookingUrl} aria-label={`Записаться на услугу ${item.title}`}>↗</a></article>)}
          </div>
          <p className="price-note">Цены указаны как ориентир и могут зависеть от длины волос, сложности работы и выбранных материалов.</p>
        </section>

        <section className="section works" id="works">
          <div className="section-heading light"><div><p className="eyebrow">Портфолио</p><h2>Результат говорит<br /><em>сам за себя</em></h2></div><p>Реальные работы мастеров «Ассоль». Листайте, вдохновляйтесь и сохраняйте идеи к визиту.</p></div>
          <div className="works-grid">
            {works.map((work, index) => <figure className={`work work-${index + 1}`} key={work.src}><Image src={work.src} alt={work.alt} width={1080} height={1440} sizes="(max-width: 720px) 82vw, 31vw" /><figcaption><span>0{index + 1}</span>{work.label}</figcaption></figure>)}
          </div>
          <a className="button button-light" href="https://vk.ru/assol_krasota">Больше работ во ВКонтакте <span>↗</span></a>
        </section>

        <section className="section team" id="team">
          <div className="section-heading"><div><p className="eyebrow">Команда</p><h2>Мастера, которым<br /><em>доверяют красоту</em></h2></div><p>Каждый мастер работает в своём направлении и внимательно слышит пожелания клиента.</p></div>
          <div className="team-grid">
            <article><span>Ю</span><div><h3>Юлия</h3><p>Парикмахер-стилист</p><small>Стрижки · окрашивание · образ</small></div></article>
            <article><span>С</span><div><h3>Снежана</h3><p>Мастер по волосам</p><small>Причёски · укладки · окрашивание</small></div></article>
            <article><span>Е</span><div><h3>Елена</h3><p>Мастер ногтевого сервиса</p><small>Маникюр · педикюр · покрытие</small></div></article>
            <article><span>Е</span><div><h3>Елена</h3><p>Массажист</p><small>Расслабление · восстановление</small></div></article>
          </div>
        </section>

        <section className="section reviews">
          <div className="review-score"><p className="eyebrow">Отзывы</p><strong>4,6</strong><span className="stars">★★★★★</span><p>На основе 54 отзывов<br />на Яндекс Картах</p></div>
          <div className="review-cards">
            {reviews.map((review) => <blockquote key={review.name}><span className="stars">★★★★★</span><p>«{review.text}»</p><footer>{review.name}</footer></blockquote>)}
          </div>
        </section>

        <section className="section atmosphere">
          <div className="atmosphere-photo"><Image src="/images/gallery-4.webp" alt="Зона ресепшена салона красоты Ассоль" width={1080} height={1440} sizes="(max-width: 720px) 100vw, 46vw" /></div>
          <div className="atmosphere-copy"><p className="eyebrow">В салоне</p><h2>Спокойно.<br /><em>Уютно. По-настоящему.</em></h2><p>Мы рядом, нас легко найти, а внутри есть всё, чтобы вы отдохнули и доверили заботу о себе профессионалам.</p><ul><li>Оплата картой</li><li>Парковка рядом</li><li>Wi-Fi</li><li>Доступная среда</li></ul></div>
        </section>

        <section className="contacts" id="contacts">
          <div className="contacts-copy"><p className="eyebrow">Контакты</p><h2>Будем рады<br /><em>видеть вас</em></h2><address>Московская область, Пушкино<br />Московский проспект, 44</address><a className="contact-phone" href="tel:+79035150818">+7 903 515-08-18</a><p className="hours">Ежедневно · 09:00–20:00</p><div className="contact-actions"><a className="button" href={bookingUrl}>Записаться онлайн <span>↗</span></a><a className="text-link" href="https://yandex.ru/maps/org/1089857323">Построить маршрут</a></div></div>
          <div className="contacts-image"><Image src="/images/photo-2.webp" alt="Вход в салон красоты Ассоль на Московском проспекте 44" width={768} height={1024} sizes="(max-width: 720px) 100vw, 46vw" /><span>Вход со стороны Московского проспекта</span></div>
        </section>
      </main>

      <footer className="footer"><a className="brand brand-footer" href="#top"><span>Ассоль</span><small>салон красоты</small></a><div><a href="https://wa.me/79035150818">WhatsApp</a><a href="https://telegram.me/+79035150818">Telegram</a><a href="https://vk.ru/assol_krasota">ВКонтакте</a></div><p>© {new Date().getFullYear()} Ассоль</p></footer>
      <a className="mobile-book" href={bookingUrl}>Записаться онлайн <span>↗</span></a>
    </>
  );
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(projectRoot, "outputs");
const outputPath = path.join(outputDir, "Ассоль.html");
const bookingOutputPath = path.join(outputDir, "Ассоль-запись.html");

const mimeTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

async function imageData(fileName) {
  const filePath = path.join(projectRoot, "public", "images", fileName);
  const bytes = await readFile(filePath);
  const mime = mimeTypes[path.extname(fileName).toLowerCase()];
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const serviceSource = await readFile(path.join(projectRoot, "app", "services-data.ts"), "utf8");
const serviceModuleSource = ts.transpileModule(serviceSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const serviceModule = await import(`data:text/javascript;base64,${Buffer.from(serviceModuleSource).toString("base64")}`);
const { catalogCategories, masters } = serviceModule;

const imageFiles = [
  "clean-color.webp",
  "hero-bob.webp",
  "portfolio-color-refresh.webp",
  "clean-women-hair.webp",
  "clean-men.webp",
  "clean-women-bob.webp",
  "clean-children.webp",
  "salon-interior-clean.webp",
  "booking-texture.jpg",
  "booking-manicure.jpg",
  "booking-pedicure.jpg",
  "booking-depilation.jpg",
  "booking-brows.jpg",
  "booking-color-tonic.webp",
];
const images = Object.fromEntries(await Promise.all(imageFiles.map(async (fileName) => [fileName, await imageData(fileName)])));

const rawCss = await readFile(path.join(projectRoot, "app", "globals.css"), "utf8");
const css = rawCss
  .replace(/^@import\s+"tailwindcss";\s*/m, "")
  .concat(`
[hidden] { display:none !important; }
.offline-note { margin:18px 0 0; color:#746d67; font-size:11px; line-height:1.55; }
.summary-image img { width:100%; height:100%; }
body.booking-view { padding-bottom:0; }
@media(max-width:720px) { body:not(.booking-view) { padding-bottom:66px; } body.booking-view .mobile-book { display:none; } }
`);

const serviceCatalog = catalogCategories.map((category, index) => `
  <details class="service-category"${index === 0 ? " open" : ""}>
    <summary>
      <span class="service-number">${escapeHtml(category.number)}</span>
      <span class="service-category-title"><strong>${escapeHtml(category.title)}</strong><small>${escapeHtml(category.description)}</small></span>
      <span class="service-category-price">${escapeHtml(category.priceFrom)}</span>
      <span class="service-toggle" aria-hidden="true">+</span>
    </summary>
    <div class="service-category-body">
      ${category.priceNote ? `<p class="service-category-note">${escapeHtml(category.priceNote)}</p>` : ""}
      <div class="service-price-grid">
        ${category.items.map((item) => `
          <article class="service-price-item">
            <div><h3>${escapeHtml(item.name)}</h3>${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}</div>
            <div class="service-price-meta">${item.duration ? `<small>${escapeHtml(item.duration)}</small>` : ""}<strong>${escapeHtml(item.price)}</strong></div>
          </article>`).join("")}
      </div>
      <a class="service-book-link" href="#booking" data-booking>Выбрать услугу и мастера <span>↗</span></a>
    </div>
  </details>`).join("");

const mainPage = `
<div id="site-page">
  <header class="header">
    <a class="brand" href="#top" aria-label="Ассоль — на главную"><span>Ассоль</span><small>салон красоты</small></a>
    <nav aria-label="Главная навигация"><a href="#services">Услуги</a><a href="#works">Работы</a><a href="#team">Мастера</a><a href="#contacts">Контакты</a></nav>
    <a class="header-phone" href="tel:+79035150818">+7 903 515-08-18</a>
    <a class="button button-small" href="#booking" data-booking>Записаться</a>
  </header>
  <main id="top">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Салон красоты в Пушкино</p>
        <h1>Красота, в которой<br><em>вы — это вы</em></h1>
        <p class="hero-lead">Стрижки, окрашивание, ногтевой сервис и уход рядом с домом. Подберём образ, который подходит вашему ритму и настроению.</p>
        <div class="hero-actions"><a class="button" href="#booking" data-booking>Записаться онлайн <span>↗</span></a><a class="text-link" href="tel:+79035150818">Позвонить</a></div>
        <div class="hero-proof"><strong>4,6</strong><span class="stars">★★★★★</span><span>54 отзыва на Яндекс Картах</span></div>
      </div>
      <div class="hero-visual" aria-label="Результат работы мастера салона">
        <img src="${images["hero-bob.webp"]}" alt="Женская стрижка боб, выполненная мастером салона Ассоль">
        <div class="hero-note"><p>Бережно к волосам.<br>Точно к вашему образу.</p></div>
      </div>
      <p class="hero-address">Пушкино · Московский проспект, 44</p>
    </section>
    <section class="marquee" aria-label="Направления салона"><div>СТРИЖКИ <i>✦</i> ОКРАШИВАНИЕ <i>✦</i> МАНИКЮР <i>✦</i> БРОВИ <i>✦</i> УХОД</div></section>
    <section class="section services" id="services">
      <div class="section-heading"><div><p class="eyebrow">Полный прайс</p><h2>Все услуги<br><em>в одном месте</em></h2></div><p>Мы перенесли подробный актуальный прайс. Откройте нужное направление, чтобы посмотреть процедуры и стоимость.</p></div>
      <div class="service-catalog">${serviceCatalog}</div>
      <p class="price-note">Итоговая стоимость окрашивания зависит от длины и густоты волос, сложности работы и расхода красителя. Мастер подтвердит цену до начала процедуры.</p>
    </section>
    <section class="section works" id="works">
      <div class="section-heading light"><div><p class="eyebrow">Портфолио</p><h2>Результат говорит<br><em>сам за себя</em></h2></div><p>Реальные работы мастеров «Ассоль». Листайте, вдохновляйтесь и сохраняйте идеи к визиту.</p></div>
      <div class="works-carousel" aria-roledescription="карусель" aria-label="Работы мастеров салона Ассоль">
        <div class="works-viewport"><div class="works-track">
          <figure class="work" aria-hidden="false"><div class="work-media"><img src="${images["portfolio-color-refresh.webp"]}" alt="Окрашивание волос до и после в салоне Ассоль"></div><figcaption><span class="work-kicker">Реальная работа</span><h3>Окрашивание · Стрижка</h3><p>Обновление цвета и формы — результат крупным планом, без ретуши.</p><a class="work-link" href="#booking" data-booking>Записаться на похожий образ <span>↗</span></a></figcaption></figure>
          <figure class="work" aria-hidden="true"><div class="work-media"><img src="${images["clean-women-hair.webp"]}" alt="Женская стрижка и укладка в салоне Ассоль"></div><figcaption><span class="work-kicker">Реальная работа</span><h3>Стрижка · Укладка</h3><p>Мягкие слои и укладка, которая подчёркивает движение волос.</p><a class="work-link" href="#booking" data-booking tabindex="-1">Записаться на похожий образ <span>↗</span></a></figcaption></figure>
          <figure class="work" aria-hidden="true"><div class="work-media"><img src="${images["clean-men.webp"]}" alt="Мужская стрижка в салоне Ассоль"></div><figcaption><span class="work-kicker">Реальная работа</span><h3>Мужская стрижка</h3><p>Чистая форма, плавный переход и аккуратная окантовка.</p><a class="work-link" href="#booking" data-booking tabindex="-1">Записаться на похожий образ <span>↗</span></a></figcaption></figure>
        </div></div>
        <div class="works-controls"><div class="works-dots" aria-label="Выбрать работу"><button class="active" type="button" data-work-slide="0" aria-label="Показать: Окрашивание и стрижка" aria-current="true"></button><button type="button" data-work-slide="1" aria-label="Показать: Стрижка и укладка"></button><button type="button" data-work-slide="2" aria-label="Показать: Мужская стрижка"></button></div><div class="works-arrows"><button type="button" data-work-prev aria-label="Предыдущая работа">←</button><button type="button" data-work-next aria-label="Следующая работа">→</button></div></div>
      </div>
      <a class="button button-light" href="https://vk.ru/assol_krasota" target="_blank" rel="noreferrer">Больше работ во ВКонтакте <span>↗</span></a>
    </section>
    <section class="section team" id="team">
      <div class="section-heading"><div><p class="eyebrow">Команда</p><h2>Мастера, которым<br><em>доверяют красоту</em></h2></div><p>Каждый мастер работает в своём направлении и внимательно слышит пожелания клиента.</p></div>
      <div class="team-grid">
        <article><span>Д</span><div><h3>Джулия</h3><p>Парикмахер-универсал</p><small>Стрижки · окрашивание · брови</small></div></article>
        <article><span>М</span><div><h3>Марина</h3><p>Мастер депиляции</p><small>Депиляция лица и тела</small></div></article>
        <article><span>С</span><div><h3>Снежана</h3><p>Парикмахер-универсал</p><small>Стрижки · окрашивание · биозавивка</small></div></article>
        <article><span>Ю</span><div><h3>Юлия</h3><p>Парикмахер-универсал, колорист</p><small>Стрижки · окрашивание · депиляция</small></div></article>
        <article><span>Е</span><div><h3>Елена</h3><p>Мастер ногтевого сервиса</p><small>Маникюр · педикюр · покрытие</small></div></article>
      </div>
    </section>
    <section class="section reviews">
      <div class="review-score"><p class="eyebrow">Отзывы</p><strong>4,6</strong><span class="stars">★★★★★</span><p>На основе 54 отзывов<br>на Яндекс Картах</p></div>
      <div class="review-cards">
        <blockquote><span class="stars">★★★★★</span><p>«Отличный мастер! Спасибо за стрижку и приятное общение! ❤️»</p><footer>Ольга</footer></blockquote>
        <blockquote><span class="stars">★★★★★</span><p>«От всей души благодарю мастера Снежану за прекрасную причёску. Получилось великолепно!»</p><footer>Ирина К.</footer></blockquote>
        <blockquote><span class="stars">★★★★★</span><p>«Прекрасные мастера, место хорошее. Возвращаюсь с удовольствием.»</p><footer>Мария</footer></blockquote>
      </div>
    </section>
    <section class="section atmosphere">
      <div class="atmosphere-photo"><img src="${images["salon-interior-clean.webp"]}" alt="Интерьер салона красоты Ассоль"></div>
      <div class="atmosphere-copy"><p class="eyebrow">В салоне</p><h2>Спокойно.<br><em>Уютно. По-настоящему.</em></h2><p>Мы рядом, нас легко найти, а внутри есть всё, чтобы вы отдохнули и доверили заботу о себе профессионалам.</p><ul><li>Оплата картой</li><li>Парковка рядом</li><li>Wi-Fi</li><li>Доступная среда</li></ul></div>
    </section>
    <section class="contacts" id="contacts">
      <div class="contacts-copy"><p class="eyebrow">Контакты</p><h2>Будем рады<br><em>видеть вас</em></h2><address>Московская область, Пушкино<br>Московский проспект, 44</address><a class="contact-phone" href="tel:+79035150818">+7 903 515-08-18</a><p class="hours">Ежедневно · 09:00–20:00</p><div class="contact-actions"><a class="button" href="#booking" data-booking>Записаться онлайн <span>↗</span></a><a class="text-link" href="https://yandex.ru/maps/org/1089857323" target="_blank" rel="noreferrer">Построить маршрут</a></div></div>
      <div class="contacts-map" aria-label="Интерактивная карта с расположением салона красоты Ассоль"><iframe class="map-frame-desktop" title="Ассоль на Яндекс Картах" src="https://yandex.ru/map-widget/v1/?ll=37.8478%2C56.0027&amp;z=15&amp;pt=37.8582615%2C56.002732%2Cpm2rdm" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe><iframe class="map-frame-mobile" title="Ассоль на Яндекс Картах — мобильная версия" src="https://yandex.ru/map-widget/v1/?ll=37.8582615%2C55.9970&amp;z=15&amp;pt=37.8582615%2C56.002732%2Cpm2rdm" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe></div>
    </section>
  </main>
  <footer class="footer"><a class="brand brand-footer" href="#top"><span>Ассоль</span><small>салон красоты</small></a><div><a href="https://wa.me/79035150818">WhatsApp</a><a href="https://telegram.me/+79035150818">Telegram</a><a href="https://vk.ru/assol_krasota">ВКонтакте</a></div><p>© <span id="offline-year"></span> Ассоль</p></footer>
  <a class="mobile-book" href="#booking" data-booking>Записаться онлайн <span>↗</span></a>
</div>`;

const bookingPage = `
<main class="booking-page" id="booking-page" hidden>
  <header class="booking-header">
    <a class="brand" href="#top" data-home aria-label="Ассоль — на главную"><span>Ассоль</span><small>салон красоты</small></a>
    <a class="booking-back" href="#top" data-home>← Вернуться на сайт</a>
    <a class="header-phone" href="tel:+79035150818">+7 903 515-08-18</a>
  </header>
  <section class="booking-intro"><div><p class="eyebrow">Запись в салон</p><h1>Выберите время<br><em>для себя</em></h1></div><p>Выберите точную услугу и мастера. Заявка сразу придёт администратору, а запись подтвердят по телефону.</p></section>
  <form class="booking-layout" id="offline-booking-form">
    <div class="booking-form">
      <fieldset class="booking-step"><legend><span>01</span><strong>Направление</strong><small>С чего начнём?</small></legend><div class="booking-categories" id="offline-categories"></div></fieldset>
      <fieldset class="booking-step"><legend><span>02</span><strong>Услуга</strong><small id="offline-service-title"></small></legend><p class="booking-price-note" id="offline-price-note" hidden></p><div class="booking-services detailed" id="offline-services"></div></fieldset>
      <fieldset class="booking-step master-step"><legend><span>03</span><strong>Мастер</strong><small>Специалисты по выбранной услуге</small></legend><div class="master-choices" id="offline-masters"></div></fieldset>
      <fieldset class="booking-step"><legend><span>04</span><strong>Дата и время</strong><small>Укажите удобное окно</small></legend><label class="date-field"><span>Желаемая дата</span><input id="offline-date" type="date" required></label><div class="time-grid" id="offline-times" aria-label="Желаемое время"></div><p class="booking-hint">Выбранное время — пожелание. Администратор подтвердит его или предложит ближайшее свободное.</p></fieldset>
      <fieldset class="booking-step"><legend><span>05</span><strong>Ваши контакты</strong><small>Чтобы подтвердить запись</small></legend><div class="contact-fields"><label><span>Имя</span><input id="offline-name" type="text" placeholder="Как к вам обращаться" autocomplete="name" minlength="2" maxlength="60" required></label><label><span>Телефон</span><input id="offline-phone" type="tel" placeholder="+7 999 000-00-00" autocomplete="tel" inputmode="tel" minlength="10" maxlength="24" pattern="[+0-9() -]{10,24}" title="Введите номер телефона: от 10 до 15 цифр" required></label><label class="wide"><span>Комментарий <small>необязательно</small></span><textarea id="offline-comment" placeholder="Расскажите о пожеланиях или задайте вопрос" rows="4" maxlength="500"></textarea></label></div></fieldset>
    </div>
    <aside class="booking-summary">
      <div class="summary-image"><img id="offline-summary-image" alt=""></div>
      <div class="summary-content"><p class="eyebrow">Ваша запись</p><h2 id="offline-summary-service"></h2><p class="summary-category" id="offline-summary-category"></p><dl><div><dt>Мастер</dt><dd id="offline-summary-master"></dd></div><div><dt>Дата</dt><dd id="offline-summary-date">Не выбрана</dd></div><div><dt>Время</dt><dd id="offline-summary-time">Не выбрано</dd></div><div><dt>Стоимость</dt><dd id="offline-summary-price"></dd></div><div><dt>Длительность</dt><dd id="offline-summary-duration"></dd></div></dl><button class="booking-submit" id="offline-submit" type="submit" disabled>Отправить заявку <span>→</span></button><p class="summary-note">Нажимая кнопку, вы отправляете заявку администратору салона. Переходить на другой сайт не потребуется.</p><p class="offline-note">Страница открывается без хостинга. Для отправки заявки потребуется подключение к интернету.</p><p class="booking-success" id="offline-success" role="status" hidden></p><p class="booking-error" id="offline-error" role="alert" hidden></p></div>
    </aside>
  </form>
  <footer class="booking-footer"><span>Пушкино · Московский проспект, 44</span><span>Ежедневно · 09:00–20:00</span></footer>
</main>`;

function standaloneApp(catalog, masterList, imageMap, bookingOnly = false) {
  const times = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:00"];
  const imageConfig = {
    color: ["booking-color-tonic.webp", "Тонирование волос в салоне Ассоль", "center 28%"],
    women: ["clean-women-bob.webp", "Женская стрижка в салоне Ассоль", "center 42%"],
    men: ["clean-men.webp", "Мужская стрижка в салоне Ассоль", "center 38%"],
    children: ["clean-children.webp", "Короткая стрижка в салоне Ассоль", "center 38%"],
    texture: ["booking-texture.jpg", "Укладка и объём волос до и после в салоне Ассоль", "center 35%"],
    manicure: ["booking-manicure.jpg", "Маникюр в салоне Ассоль", "center 50%"],
    pedicure: ["booking-pedicure.jpg", "Педикюр в салоне Ассоль", "center 46%"],
    depilation: ["booking-depilation.jpg", "Депиляция в салоне Ассоль", "center 42%"],
    brows: ["booking-brows.jpg", "Архитектура и окрашивание бровей", "center 50%"],
  };
  const state = { categoryId: catalog[0].id, itemId: catalog[0].items[0].id, masterId: catalog[0].masterIds[0], time: "", submitState: "idle" };
  const byId = (id) => document.getElementById(id);
  const safe = (value) => String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
  const category = () => catalog.find((item) => item.id === state.categoryId) || catalog[0];
  const service = () => category().items.find((item) => item.id === state.itemId) || category().items[0];
  const availableMasters = () => category().masterIds.map((id) => masterList.find((master) => master.id === id)).filter(Boolean);
  const master = () => availableMasters().find((item) => item.id === state.masterId) || availableMasters()[0];

  function resetFeedback() {
    state.submitState = "idle";
    byId("offline-success").hidden = true;
    byId("offline-error").hidden = true;
  }

  function setView() {
    const sitePage = byId("site-page");
    const bookingVisible = bookingOnly || location.hash === "#booking";
    if (sitePage) sitePage.hidden = bookingVisible;
    byId("booking-page").hidden = !bookingVisible;
    document.body.classList.toggle("booking-view", bookingVisible);
    if (bookingVisible) {
      renderBooking();
      window.scrollTo(0, 0);
    }
  }

  function initPortfolioCarousel() {
    const carousel = document.querySelector(".works-carousel");
    if (!carousel) return;
    const track = carousel.querySelector(".works-track");
    const slides = Array.from(carousel.querySelectorAll(".work"));
    const dots = Array.from(carousel.querySelectorAll("[data-work-slide]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let activeIndex = 0;
    let paused = false;
    let timer;

    function showSlide(index) {
      activeIndex = (index + slides.length) % slides.length;
      track.style.transform = `translateX(-${activeIndex * 100}%)`;
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === activeIndex;
        slide.setAttribute("aria-hidden", String(!active));
        const link = slide.querySelector("a");
        if (link) link.tabIndex = active ? 0 : -1;
      });
      dots.forEach((dot, dotIndex) => {
        const active = dotIndex === activeIndex;
        dot.classList.toggle("active", active);
        if (active) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      });
    }

    function stopAutoplay() {
      window.clearInterval(timer);
    }

    function startAutoplay() {
      stopAutoplay();
      if (!paused && !reducedMotion) timer = window.setInterval(() => showSlide(activeIndex + 1), 5200);
    }

    carousel.addEventListener("mouseenter", () => { paused = true; stopAutoplay(); });
    carousel.addEventListener("mouseleave", () => { paused = false; startAutoplay(); });
    carousel.addEventListener("focusin", () => { paused = true; stopAutoplay(); });
    carousel.addEventListener("focusout", (event) => {
      if (!carousel.contains(event.relatedTarget)) { paused = false; startAutoplay(); }
    });
    carousel.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.hasAttribute("data-work-prev")) showSlide(activeIndex - 1);
      if (button.hasAttribute("data-work-next")) showSlide(activeIndex + 1);
      if (button.hasAttribute("data-work-slide")) showSlide(Number(button.dataset.workSlide));
      startAutoplay();
    });
    showSlide(0);
    startAutoplay();
  }

  function selectCategory(categoryId) {
    const selected = catalog.find((item) => item.id === categoryId) || catalog[0];
    state.categoryId = selected.id;
    state.itemId = selected.items[0].id;
    state.masterId = selected.masterIds[0];
    resetFeedback();
    renderBooking();
  }

  function selectService(itemId) {
    state.itemId = itemId;
    resetFeedback();
    renderBooking();
  }

  function selectMaster(masterId) {
    state.masterId = masterId;
    resetFeedback();
    renderBooking();
  }

  function selectTime(time) {
    state.time = time;
    resetFeedback();
    renderBooking();
  }

  function renderBooking() {
    const selectedCategory = category();
    const selectedService = service();
    const selectedMaster = master();
    byId("offline-categories").innerHTML = catalog.map((item) => `<button class="category-choice${item.id === state.categoryId ? " active" : ""}" type="button" data-category="${safe(item.id)}" aria-pressed="${item.id === state.categoryId}"><span>${safe(item.number)}</span><strong>${safe(item.shortTitle)}</strong><small>${safe(item.priceFrom)}</small></button>`).join("");
    byId("offline-service-title").textContent = selectedCategory.title;
    const note = byId("offline-price-note");
    note.hidden = !selectedCategory.priceNote;
    note.textContent = selectedCategory.priceNote || "";
    byId("offline-services").innerHTML = selectedCategory.items.map((item) => `<button class="service-choice${item.id === state.itemId ? " active" : ""}" type="button" data-service="${safe(item.id)}" aria-pressed="${item.id === state.itemId}"><span>${safe(item.name)}</span>${item.note ? `<small>${safe(item.note)}</small>` : ""}<strong>${safe(item.price)}</strong>${item.duration ? `<em>${safe(item.duration)}</em>` : ""}</button>`).join("");
    byId("offline-masters").innerHTML = availableMasters().map((item) => `<button class="master-choice${item.id === selectedMaster.id ? " active" : ""}" type="button" data-master="${safe(item.id)}" aria-pressed="${item.id === selectedMaster.id}"><span class="master-initial">${safe(item.initial)}</span><span><strong>${safe(item.name)}</strong><small>${safe(item.role)}</small></span><i aria-hidden="true">✓</i></button>`).join("");
    byId("offline-times").innerHTML = times.map((item) => `<button class="time-choice${item === state.time ? " active" : ""}" type="button" data-time="${item}" aria-pressed="${item === state.time}">${item}</button>`).join("");
    const config = imageConfig[selectedCategory.id] || imageConfig.color;
    const summaryImage = byId("offline-summary-image");
    summaryImage.src = imageMap[config[0]];
    summaryImage.alt = config[1];
    summaryImage.style.objectPosition = config[2];
    byId("offline-summary-service").textContent = selectedService.name;
    byId("offline-summary-category").textContent = selectedCategory.title;
    byId("offline-summary-master").textContent = selectedMaster.name;
    byId("offline-summary-price").textContent = selectedService.price;
    byId("offline-summary-duration").textContent = selectedService.duration || "уточним";
    byId("offline-summary-time").textContent = state.time || "Не выбрано";
    const date = byId("offline-date").value;
    byId("offline-summary-date").textContent = date ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`)) : "Не выбрана";
    updateReady();
  }

  function updateReady() {
    const phoneDigits = byId("offline-phone").value.replace(/\D/g, "");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
    const ready = Boolean(byId("offline-date").value >= today && state.time && byId("offline-name").value.trim().length >= 2 && phoneDigits.length >= 10 && phoneDigits.length <= 15);
    const submit = byId("offline-submit");
    submit.disabled = !ready || state.submitState === "sending" || state.submitState === "success";
    submit.innerHTML = state.submitState === "sending" ? "Отправляем… <span>→</span>" : state.submitState === "success" ? "Заявка отправлена <span>✓</span>" : "Отправить заявку <span>→</span>";
  }

  byId("offline-booking-form").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.category) selectCategory(button.dataset.category);
    if (button.dataset.service) selectService(button.dataset.service);
    if (button.dataset.master) selectMaster(button.dataset.master);
    if (button.dataset.time) selectTime(button.dataset.time);
  });
  ["offline-date", "offline-name", "offline-phone", "offline-comment"].forEach((id) => byId(id).addEventListener("input", () => {
    resetFeedback();
    renderBooking();
  }));
  byId("offline-booking-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (byId("offline-submit").disabled) return;
    const selectedCategory = category();
    const selectedService = service();
    const selectedMaster = master();
    const date = byId("offline-date").value;
    const formattedDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
    const comment = byId("offline-comment").value.trim();
    const message = [
      "Здравствуйте! Хочу записаться в салон «Ассоль».",
      `Направление: ${selectedCategory.title}`,
      `Услуга: ${selectedService.name}`,
      `Стоимость по прайсу: ${selectedService.price}`,
      `Мастер: ${selectedMaster.name}`,
      `Желаемые дата и время: ${formattedDate}, ${state.time}`,
      `Имя: ${byId("offline-name").value.trim()}`,
      `Телефон: ${byId("offline-phone").value.trim()}`,
      comment ? `Комментарий: ${comment}` : "",
    ].filter(Boolean).join("\n");
    state.submitState = "sending";
    updateReady();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    const success = byId("offline-success");
    const error = byId("offline-error");
    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ access_key: "bced2591-0bba-4e8a-ae26-060c040ec31a", subject: `Новая заявка: ${selectedService.name}`, from_name: "Сайт салона «Ассоль»", recipient: "jokerz44677@gmail.com", name: byId("offline-name").value.trim(), phone: byId("offline-phone").value.trim(), category: selectedCategory.title, service: selectedService.name, price: selectedService.price, master: selectedMaster.name, date: formattedDate, time: state.time, comment: comment || "Не указан", message, botcheck: "" }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error("Submission failed");
      state.submitState = "success";
      success.innerHTML = '<span aria-hidden="true">✓</span><strong>Заявка отправлена</strong> Администратор свяжется с вами по телефону для подтверждения записи.';
      success.hidden = false;
    } catch {
      state.submitState = "error";
      error.innerHTML = "<strong>Не удалось отправить заявку.</strong> Проверьте подключение к интернету и попробуйте ещё раз или позвоните по номеру +7 903 515-08-18.";
      error.hidden = false;
    } finally {
      window.clearTimeout(timeoutId);
      updateReady();
    }
  });

  byId("offline-date").min = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
  const year = byId("offline-year");
  if (year) year.textContent = String(new Date().getFullYear());
  window.addEventListener("hashchange", setView);
  document.querySelectorAll("[data-home]").forEach((link) => link.addEventListener("click", (event) => {
    if (bookingOnly) {
      event.preventDefault();
      window.scrollTo(0, 0);
    } else {
      location.hash = "#top";
    }
  }));
  document.querySelectorAll("[data-booking]").forEach((link) => link.addEventListener("click", () => { location.hash = "#booking"; }));
  renderBooking();
  setView();
  initPortfolioCarousel();
}

const serializedCatalog = JSON.stringify(catalogCategories).replaceAll("<", "\\u003c");
const serializedMasters = JSON.stringify(masters).replaceAll("<", "\\u003c");
const serializedImages = JSON.stringify(images);
const runtimeSource = `(${standaloneApp.toString()})(${serializedCatalog},${serializedMasters},${serializedImages},false);`;
const bookingRuntimeSource = `(${standaloneApp.toString()})(${serializedCatalog},${serializedMasters},${serializedImages},true);`;
const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Салон красоты Ассоль в Пушкино. Автономная версия сайта.">
  <title>Ассоль — салон красоты в Пушкино</title>
  <style>${css}</style>
</head>
<body>
${mainPage}
${bookingPage}
<script>${runtimeSource}</script>
</body>
</html>`;

const bookingHtml = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Автономная запись в салон красоты Ассоль в Пушкино.">
  <title>Запись в салон — Ассоль</title>
  <style>${css}</style>
</head>
<body class="booking-view">
${bookingPage.replace('id="booking-page" hidden', 'id="booking-page"').replace("← Вернуться на сайт", "↑ В начало страницы")}
<script>${bookingRuntimeSource}</script>
</body>
</html>`;

new Function(runtimeSource);
new Function(bookingRuntimeSource);
if ([html, bookingHtml].some((document) => /<script\b[^>]*\bsrc=|<link\b[^>]*\brel=["']stylesheet|<img\b[^>]*\bsrc=["'](?!data:)/i.test(document))) {
  throw new Error("Standalone file contains an external script, stylesheet, or image dependency.");
}

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, html, "utf8");
await writeFile(bookingOutputPath, bookingHtml, "utf8");
console.log(outputPath);
console.log(bookingOutputPath);

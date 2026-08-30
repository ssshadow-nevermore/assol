import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/admin/AdminDashboard.tsx", import.meta.url), "utf8");
const benefitsSource = await readFile(new URL("../app/BenefitsShowcase.tsx", import.meta.url), "utf8");
const benefitPriceSource = await readFile(new URL("../app/ServiceBenefitPrice.tsx", import.meta.url), "utf8");
const stylesSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const siteDataSource = await readFile(new URL("../app/site-data.ts", import.meta.url), "utf8");

test("visual admin exposes only client-facing sections", () => {
  assert.match(source, /offerConditions/);
  for (const technicalLabel of ["Адрес предложения", "Назначение ссылки", "Скидки по услугам"]) {
    assert.doesNotMatch(source, new RegExp(technicalLabel), `${technicalLabel} must stay outside the visual editor`);
  }
  for (const section of ["admin-categories", "admin-offers", "admin-hours", "admin-portfolio", "admin-contacts", "admin-site-blocks"]) {
    assert.match(source, new RegExp(section));
  }
  assert.match(source, /Часы работы/);
  assert.match(source, /Дни недели фиксированы/);
  assert.doesNotMatch(source, /aria-label="Тип контакта"/);
});

test("master editor exposes only text fields and no photo controls", () => {
  assert.match(source, /id="admin-masters"/);
  assert.match(source, /Редактируйте имя, специализацию и виды услуг/);
  assert.match(source, /field\("Имя"/);
  assert.match(source, /field\("Специализация"/);
  assert.match(source, /field\("Виды услуг"/);
  assert.doesNotMatch(source, /admin-master-file-input|Фото мастера|Загрузить фото.*мастера|Удалить фото.*мастера/);
});

test("site blocks expose editable award copy and atmosphere media while keeping the review CTA fixed", async () => {
  assert.match(source, /Изменить блоки/);
  assert.match(source, /Надпись награды/);
  assert.match(source, /Заголовок награды/);
  assert.match(source, /Текст награды/);
  assert.match(source, /Видео награды/);
  assert.match(source, /Фото блока «В салоне»/);
  assert.match(source, /DEFAULT_AWARD_DESCRIPTION/);
  assert.match(source, /award_description: text\(row, "award_description"\) \|\| DEFAULT_AWARD_DESCRIPTION/);
  assert.match(source, /resource=salon_settings&id=1&field=\$\{field\}/);
  assert.match(source, /uploadSiteMedia\(file, field\)/);
  assert.doesNotMatch(source, /Изменить ссылку на Яндекс Карты/);

  const siteData = await readFile(new URL("../app/site-data.ts", import.meta.url), "utf8");
  assert.match(siteData, /award: \{/);
  assert.match(siteData, /videoUrl: resolveMediaUrl\(salonRow\.award_video_url, salonRow\.award_video_storage_key\)/);
  assert.match(siteData, /imageUrl: resolveMediaUrl\(salonRow\.atmosphere_image_url, salonRow\.atmosphere_image_storage_key\)/);
  const mediaSource = await readFile(new URL("../app/api/admin/media/route.ts", import.meta.url), "utf8");
  assert.match(mediaSource, /"salon_settings"/);
  assert.match(mediaSource, /award_video_storage_key/);
  assert.match(mediaSource, /atmosphere_image_storage_key/);
});

test("offers are rendered and hidden independently by their own database id", () => {
  assert.match(source, /visibleOffers\.map/);
  assert.match(source, /key=\{String\(offer\.id\)\}/);
  assert.match(source, /toggleHidden\("offers", offer\)/);
  assert.doesNotMatch(source, /offer:loyalty-sixth-haircut|offer:discount-certificate/);
  assert.match(source, /offerServiceIds/);
  assert.match(source, /Тип предложения/);
  assert.match(source, /Что показать вместо цены/);
});

test("portfolio editor keeps legacy and managed media paths and supports replacement", () => {
  assert.match(source, /image_storage_key/);
  assert.match(source, /imageUrl\(item\)/);
  assert.match(source, /api\/admin\/media/);
  assert.match(source, /fieldQuery = modal === "offers" \? `&field=\$\{side\}`/);
  assert.match(source, /Загрузить фото/);
  assert.match(source, /Удалить фото/);
  assert.match(source, /Удалить запись/);
  assert.match(source, /mediaInputRef\.current\?\.click\(\)/);
  assert.match(source, /setDraft\(\(current\) => modal === "offers"/);
  assert.match(source, /resource === "offers"\) \{[\s\S]*field of \["front", "back"\]/);
  assert.match(source, /const uploads: Array<\{ side: "front" \| "back"; file: File \}>/);
  assert.match(source, /Promise\.allSettled\(uploads\.map/);
  assert.match(source, /setMediaFile\(null\);/);
  assert.match(source, /field\("Описание работы"/);
  assert.match(source, /text\(draft, "description"\)/);
});

test("all image editors preview normalized files and clean temporary object URLs", () => {
  assert.match(source, /type MediaPreviewKey = "portfolio" \| "front" \| "back" \| "atmosphere"/);
  assert.match(source, /const \[mediaPreviewUrls, setMediaPreviewUrls\] = useState<MediaPreviewUrls>\(\{\}\)/);
  assert.match(source, /const mediaPreviewUrlsRef = useRef<MediaPreviewUrls>\(\{\}\)/);
  assert.match(source, /const replaceMediaPreview = useCallback\(\(key: MediaPreviewKey, file: File \| null\)/);
  assert.match(source, /URL\.createObjectURL\(file\)/);
  assert.match(source, /URL\.revokeObjectURL\(previousUrl\)/);
  assert.match(source, /Object\.values\(mediaPreviewUrlsRef\.current\)\.forEach\(\(url\) => \{[\s\S]*?URL\.revokeObjectURL\(url\)/);
  assert.match(source, /const currentImage = modal === "portfolio_items" \? mediaPreviewUrls\.portfolio \|\| imageUrl\(draft\)/);
  assert.match(source, /const previewKey: MediaPreviewKey = modal === "portfolio_items" \? "portfolio" : field/);
  assert.match(source, /replaceMediaPreview\(previewKey, normalized\)/);
  assert.match(source, /const preview = mediaPreviewUrls\[side\] \|\| imageUrl\(draft, side\)/);
  assert.match(source, /replaceMediaPreview\(modal === "portfolio_items" \? "portfolio" : selectedField, null\)/);
  assert.match(source, /replaceMediaPreview\("atmosphere", normalized\)/);
  assert.match(source, /replaceMediaPreview\("atmosphere", null\)/);
  assert.match(source, /mediaPreviewUrls\.atmosphere \|\| siteBlockMediaUrl\(draft, "atmosphere"\)/);
  assert.match(source, /clearMediaPreviews\(\);[\s\S]*setModal\(null\)/);
  assert.match(source, /setPendingMediaFiles\(\{\}\)/);
});

test("offer front and back previews remain independent and prefer local files", () => {
  assert.match(source, /mediaPreviewUrls\[side\] \|\| imageUrl\(draft, side\)/);
  assert.match(source, /replaceMediaPreview\(previewKey, normalized\)/);
  assert.match(source, /setPendingMediaFiles\(\(current\) => \(\{ \.\.\.current, \[field\]: normalized \}\)\)/);
  assert.match(source, /replaceMediaPreview\(modal === "portfolio_items" \? "portfolio" : field, null\)/);
  assert.match(source, /replaceMediaPreview\(modal === "portfolio_items" \? "portfolio" : selectedField, null\)/);
  assert.match(source, /offerMediaPanel\("front"\).*offerMediaPanel\("back"\)/s);
});

test("image previews are cleared on success, error, close, and unmount", () => {
  assert.match(source, /if \(modal === "portfolio_items" \|\| modal === "offers"\) clearMediaPreviews\(\)/);
  assert.match(source, /await refresh\(true\); clearMediaPreviews\(\); setModal\(null\)/);
  assert.match(source, /return \(\) => \{[\s\S]*?Object\.values\(mediaPreviewUrlsRef\.current\)/);
  assert.match(source, /if \(field === "atmosphere"\) replaceMediaPreview\("atmosphere", null\)/);
});

test("existing portfolio records may clear media without being rejected as new records", async () => {
  assert.match(source, /if \(!modalId && !text\(body, "image_url"\) && !text\(body, "image_storage_key"\)\)/);
  const adminApiSource = await readFile(new URL("../app/api/admin/admin-api.ts", import.meta.url), "utf8");
  assert.match(adminApiSource, /portfolio_items.*!existing.*image_url/);
  assert.match(adminApiSource, /portfolio_items.*existing.*result\.image_url = ""/);
});

test("price tier editor can add more than one tier", () => {
  assert.match(source, /admin-price-editor-head.*Добавить вариант/);
  assert.doesNotMatch(source, /tiers\.length === 0 && <button type="button" className="admin-text-button" onClick=\{addTier\}>Добавить вариант<\/button>/);
});

test("failed media upload clears the selected file so another file can be chosen", () => {
  assert.match(source, /A rejected file must not remain selected/);
  assert.match(source, /if \(mediaInputRef\.current\) mediaInputRef\.current\.value = "";[\s\S]*setMediaFile\(null\);/);
});

test("media deletion keeps the D1 reference until object removal succeeds", async () => {
  const mediaSource = await readFile(new URL("../app/api/admin/media/route.ts", import.meta.url), "utf8");
  assert.match(mediaSource, /Remove the managed object first/);
  assert.match(mediaSource, /await deleteYandexObject\(env, row\.storage_key\)/);
  assert.match(mediaSource, /image_storage_key = NULL/);
  assert.match(mediaSource, /image_url = ''/);
  assert.doesNotMatch(mediaSource, /image_storage_key = NULL, image_url = '', is_active = 0/);
});

test("offer media writes the selected front/back storage reference to D1", async () => {
  const mediaSource = await readFile(new URL("../app/api/admin/media/route.ts", import.meta.url), "utf8");
  assert.match(mediaSource, /function mediaColumns\(resource: MediaResource, field: MediaField\)/);
  assert.match(mediaSource, /front_storage_key/);
  assert.match(mediaSource, /back_storage_key/);
  assert.match(mediaSource, /fieldInput\(resource, url\.searchParams\.get\("field"\)\)/);
  assert.match(mediaSource, /UPDATE \$\{table\} SET \$\{columns\.key\} = \?, \$\{columns\.url\} = NULL/);
  assert.match(mediaSource, /field \}, 201/);
});

test("offer media input binds the selected side synchronously", () => {
  assert.match(source, /input\.dataset\.mediaField = side/);
  assert.match(source, /data-media-field=\{mediaField\}/);
  assert.match(source, /dataset\.mediaField === "back" \? "back" : "front"/);
});

test("failed back upload cannot leave a new offer flip-enabled without its back", () => {
  assert.match(source, /pendingUploadKeys/);
  assert.match(source, /const restoreBody = previousOffer\s*\n\s*\? \{ flip_enabled: previousOffer\.flip_enabled/);
  assert.match(source, /: \{ flip_enabled: 0,/);
});

test("offer back-photo deletion uses the clicked side and protects an enabled flip", () => {
  assert.match(source, /async function removeMedia\(fieldOverride\?: "front" \| "back"\)/);
  assert.match(source, /const field = fieldOverride \?\? mediaField/);
  assert.match(source, /field === "back"[\s\S]*Сначала выключите переворот карточки/);
  assert.match(source, /void removeMedia\(side\)/);
});

test("editing an ordinary offer preserves existing service-rule values", () => {
  assert.match(source, /Keep ordinary offer rules intact/);
  assert.match(source, /else \{[\s\S]*?pendingExisting\.push\(api\("offer_service_rules", "PATCH", String\(rule\.id\), \{ is_active: 1 \}(?:, signal)?\)\);/);
});

test("ordinary offer badge and replacement text stay separate in the D1 mapper", () => {
  assert.match(siteDataSource, /const promotionBenefit = benefits\.find/);
  assert.match(siteDataSource, /promotionLabel: promotionBenefit\?\.label/);
  assert.match(siteDataSource, /promotionPriceText: promotionBenefit\?\.priceText/);
  assert.match(siteDataSource, /benefits: benefits\.length \? benefits : undefined/);
  assert.doesNotMatch(siteDataSource, /promotionPriceText:[^\n]*promotion\.short_title/);
});

test("admin modal is keyboard-safe and serializes destructive/media operations", () => {
  assert.match(source, /const modalRef = useRef/);
  assert.match(source, /const operationLockRef = useRef/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /focusableSelector/);
  assert.match(source, /operationLockRef\.current = true/);
  assert.match(source, /if \(operationLockRef\.current\) return/);
  assert.match(source, /ref=\{modalRef\}/);
  assert.match(source, /closeEditor\(true\)/);
});

test("saving can be cancelled from modal controls without leaving the operation lock", () => {
  assert.match(source, /const operationAbortRef = useRef<AbortController \| null>\(null\)/);
  assert.match(source, /const cancelAndCloseEditor = useCallback/);
  assert.match(source, /operationAbortRef\.current\?\.abort\(\)/);
  assert.match(source, /onClick=\{cancelAndCloseEditor\}/);
  assert.match(source, /if \(externalSignal\)/);
  assert.match(source, /Сохранение отменено/);
});

test("visual admin preserves scroll position and renders a bottom notification", () => {
  assert.match(source, /refresh = useCallback\(async \(preserveScroll = false(?:, signal\?: AbortSignal)?\)/);
  assert.match(source, /window\.scrollTo\(\{ top: savedScrollY/);
  assert.match(source, /await refresh\(true\)/);
  assert.match(source, /admin-visual-toast/);
});

test("contact editor hydrates saved phone and email and seven-day add is handled in the UI", () => {
  assert.match(source, /next\.phone = text\(row, "phone"\) \|\| text\(row, "display_phone"\)/);
  assert.match(source, /next\.email = text\(row, "email"\) \|\| text\(row, "contact_email"\)/);
  assert.match(source, /async function openContactEditor\(\)/);
  assert.match(source, /setContactPhone\(String\(next\.phone/);
  assert.match(source, /value=\{contactPhone\}/);
  assert.match(source, /value=\{contactEmail\}/);
  assert.match(source, /Все дни недели уже добавлены/);
});

test("visual admin supports drag-and-drop ordering without exposing sort fields", () => {
  assert.match(source, /function reorderItems\(resource: EditableResource/);
  assert.match(source, /draggable: true/);
  assert.match(source, /setData\("text\/plain", id\)/);
  assert.match(source, /sort_order: index/);
  assert.match(source, /Перетащите карточку или услугу/);
  assert.doesNotMatch(source, /Порядок отображения/);
});

test("offers remain data-driven and extra offers use a carousel", () => {
  assert.match(benefitsSource, /offers\.filter/);
  assert.match(benefitsSource, /benefit-extra-carousel/);
  assert.match(benefitsSource, /setIndex/);
  assert.match(benefitsSource, /Math\.min\(index, offers\.length - 1\)/);
});

test("all active loyalty and certificate offers render as independent feature cards", () => {
  assert.match(benefitsSource, /const loyaltyOffers = offers\.filter/);
  assert.match(benefitsSource, /const certificateOffers = offers\.filter/);
  assert.match(benefitsSource, /const featureOffers = \[\.\.\.loyaltyOffers, \.\.\.certificateOffers\]/);
  assert.match(benefitsSource, /const allOffers = \[\.\.\.featureOffers/);
  assert.match(benefitsSource, /offers\.map\(\(offer\) => <div className=\{`benefit-offer-slide/);
  assert.match(benefitsSource, /data-offer-id=\{offer\.id\}/);
  assert.doesNotMatch(benefitsSource, /const certificate = offers\.find/);
});

test("offer editor exposes only promotion and certificate choices", () => {
  assert.doesNotMatch(source, /Акция для новых клиентов/);
  assert.match(source, /<option value="promotion">Акция<\/option><option value="certificate">Сертификат<\/option>/);
});

test("mobile flip cards keep front media visible and swap stacking only when flipped", () => {
  assert.match(stylesSource, /\.benefit-offer-media \{[^}]*aspect-ratio:4\/3/);
  assert.match(stylesSource, /\.benefit-offer-copy \{ grid-area:copy;[^}]*position:static/);
  assert.match(stylesSource, /\.flip-card-front \{ z-index:2; transform:rotateY\(0deg\)/);
  assert.match(stylesSource, /\.flip-card\.is-flipped \.flip-card-front,\.flip-card:focus-visible \.flip-card-front \{ z-index:1/);
  assert.match(stylesSource, /@media \(hover:hover\) and \(pointer:fine\)/);
  assert.doesNotMatch(stylesSource, /\.benefit-offer-copy \{[^}]*position:absolute/);
});

test("offer card media and copy stay in independent layout flow tracks", () => {
  assert.match(stylesSource, /\.benefit-offer \{[^}]*grid-template-rows:auto auto/);
  assert.match(stylesSource, /\.benefit-offer-media \{[^}]*height:auto[^}]*min-height:0[^}]*aspect-ratio:4\/3/);
  assert.match(stylesSource, /\.admin-offer-card>img \{[^}]*height:auto[^}]*min-height:0[^}]*aspect-ratio:4\/3/);
  assert.match(stylesSource, /@media\(max-width:760px\)\s*\{[\s\S]*?\.admin-offer-card \{[^}]*grid-template-rows:auto auto/);
  assert.match(stylesSource, /\.admin-offer-card-copy \{ grid-area:copy; \}/);
  assert.match(stylesSource, /\.benefit-extra-card \{[^}]*grid-template-rows:auto auto/);
  assert.match(stylesSource, /\.benefit-extra-card>div \{ grid-column:1; grid-row:2;[^}]*position:static/);
});

test("offer media input can select the same file for front and back", () => {
  assert.match(source, /input\.value = ""; input\.dataset\.mediaField = side; input\.click\(\)/);
  assert.match(source, /const ADMIN_MEDIA_TIMEOUT_MS = 60_000/);
});

test("staged offer uploads bound response-body reads to the save operation", () => {
  assert.match(source, /const uploadPayload = await readJsonWithTimeout<\{ storage_key\?: string; error\?: string \}>\(uploadResponse, ADMIN_MEDIA_TIMEOUT_MS, operationSignal\)/);
});

test("portfolio editor keeps alt text internal and derives it when hidden", () => {
  assert.doesNotMatch(source, /field\("Alt-текст"/);
  assert.match(source, /body\.alt_text = text\(body, "alt_text"\)\.trim\(\) \|\| text\(body, "title"\)\.trim\(\)/);
});

test("legacy offer images fall back without hiding active certificates", () => {
  assert.match(siteDataSource, /row\.type === "certificate" \? "[^"]*certificate-front\.webp"/);
  assert.match(siteDataSource, /row\.type === "certificate" \? "[^"]*certificate-back\.webp"/);
  assert.match(siteDataSource, /WHERE status = 'active'/);
  assert.match(benefitsSource, /const allOffers = \[\.\.\.featureOffers/);
  assert.match(benefitsSource, /<OfferCarousel offers=\{allOffers\}/);
});

test("new certificate drafts do not inherit legacy artwork", () => {
  assert.match(source, /const persisted = row && row\.id !== undefined/);
  assert.match(source, /if \(persisted && field !== "portfolio"\)/);
});

test("public page is dynamic so D1 edits appear without a restart", () => {
  assert.match(pageSource, /export const dynamic = "force-dynamic"/);
  assert.match(pageSource, /export const revalidate = 0/);
});

test("public contract links cannot be hidden, deleted, or renamed through CRUD", async () => {
  const adminApiSource = await readFile(new URL("../app/api/admin/admin-api.ts", import.meta.url), "utf8");
  assert.match(adminApiSource, /REQUIRED_EXTERNAL_LINK_KEYS/);
  assert.match(adminApiSource, /assertRequiredExternalLinkMutation\(resource, existing, input, "update"\)/);
  assert.match(adminApiSource, /assertRequiredExternalLinkMutation\(resource, existing, \{\}, "hide"\)/);
  assert.match(adminApiSource, /assertRequiredExternalLinkMutation\(resource, existing, \{\}, "delete"\)/);
});

test("malformed login JSON returns the generic authentication error", async () => {
  const loginSource = await readFile(new URL("../app/api/admin/login/route.ts", import.meta.url), "utf8");
  assert.match(loginSource, /error instanceof SyntaxError/);
  assert.match(loginSource, /Неверный логин или пароль/);
  assert.match(loginSource, /status: 401/);
});

test("service directions keep the same text in an animated marquee", () => {
  assert.match(pageSource, /className="marquee-track"/);
  assert.match(pageSource, /<i aria-hidden="true">✦<\/i><b>\{direction\}<\/b>/);
  assert.match(stylesSource, /\.marquee-track \{[^}]*min-width:max-content[^}]*flex-wrap:nowrap!important[^}]*white-space:nowrap!important/);
  assert.match(stylesSource, /\.marquee-sequence \{[^}]*gap:clamp\(18px,3vw,48px\)/);
  assert.match(stylesSource, /\.marquee-item \{[^}]*flex:0 0 auto!important[^}]*white-space:nowrap!important/);
  assert.match(stylesSource, /@keyframes marquee-scroll/);
  assert.match(stylesSource, /prefers-reduced-motion:reduce/);
});

test("carousels remain safe when their data is empty or shrinks", async () => {
  const portfolioSource = await readFile(new URL("../app/PortfolioCarousel.tsx", import.meta.url), "utf8");
  assert.match(portfolioSource, /works\.length === 0/);
  assert.match(portfolioSource, /works\.length < 2/);
  assert.match(portfolioSource, /Math\.min\(activeIndex, works\.length - 1\)/);
  assert.match(portfolioSource, /className="work-description"/);
});

test("new offer media is staged before the database row is written", () => {
  assert.match(source, /const pendingUploadKeys: string\[\] = \[\]/);
  assert.match(source, /const stagedResults = await Promise\.allSettled\(uploads\.map/);
  assert.match(source, /const failedUpload = stagedResults\.find/);
  assert.match(source, /body\[`\$\{side\}_storage_key`\] = key/);
  assert.match(source, /body\[`\$\{side\}_url`\] = null/);
  assert.match(source, /pendingUploadKeys\.map\(\(key\) => fetchWithTimeout/);
});

test("discounted price activates only from its badge", () => {
  assert.match(benefitPriceSource, /onPointerEnter=\{\(\) => setHoveredBenefitId\(benefit\.id\)\}/);
  assert.match(benefitPriceSource, /onFocus=\{\(\) => setFocusedBenefitId\(benefit\.id\)\}/);
  assert.match(benefitPriceSource, /onClick=\{\(\) => setActiveBenefitId/);
  assert.match(benefitPriceSource, /resolvedBenefits\.map/);
  assert.doesNotMatch(stylesSource, /\.service-benefit-price:hover/);
  assert.doesNotMatch(stylesSource, /\.service-benefit-price:focus-within/);
  assert.match(stylesSource, /\.service-benefit-price\.is-active \.benefit-price-new/);
  assert.match(stylesSource, /\.benefit-price-stack[^}]*pointer-events:none/);
});

test("repeated badge click clears hover and focus so the regular price returns", () => {
  assert.match(benefitPriceSource, /if \(next === null\) \{[\s\S]*setHoveredBenefitId\(null\);[\s\S]*setFocusedBenefitId\(null\);/);
});

test("certificate conditions are data-driven and new certificates do not receive defaults", () => {
  assert.match(source, /const conditionDraftsRef = useRef<Row\[\]>\(\[\]\)/);
  assert.match(source, /const sourceDrafts = conditionDraftsRef\.current/);
  assert.match(source, /conditionDraftsRef\.current = next/);
  assert.doesNotMatch(source, /minimum_single_service_price.*Бесплатная выдача сертификата/);
  assert.match(benefitsSource, /offer\.conditions/);
  assert.match(benefitsSource, /\.sort\(\(left, right\) => left\.sortOrder - right\.sortOrder\)/);
  assert.doesNotMatch(benefitsSource, /certificateUseCases/);
});

test("working-hours editor exposes fixed weekdays without add/hide/delete controls", () => {
  assert.match(source, /const fixedWorkingHours = useMemo/);
  assert.match(source, /fixedWorkingHours\.map/);
  assert.doesNotMatch(source, /field\("Примечание"/);
  assert.doesNotMatch(source, /\+ Добавить день/);
  assert.doesNotMatch(source, /toggleHidden\("working_hours"/);
  assert.doesNotMatch(source, /deleteObject\("working_hours"/);
  assert.match(source, /modal !== "salon_settings" && modal !== "working_hours" && !mapEditorMode/);
});

test("all active service offers become independent badges", () => {
  assert.match(benefitPriceSource, /resolvedBenefits\.map/);
  assert.match(benefitPriceSource, /activeBenefitId === benefit\.id/);
  assert.match(stylesSource, /\.benefit-badges \{[^}]*flex-wrap:wrap/);
});

test("hero review arrow stays beside the review text", () => {
  assert.match(stylesSource, /\.hero-proof \{[^}]*gap:2px/);
  assert.match(stylesSource, /\.hero-proof \{[^}]*width:max-content/);
  assert.match(stylesSource, /\.hero-proof strong \{ margin-left:0/);
});

test("visual editor keeps focus while editing price tiers and uses simple offer conditions", () => {
  assert.match(source, /key=\{tier\.id\}/);
  assert.match(source, /createClientId\("tier"\)/);
  assert.doesNotMatch(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /aria-label="Условие сертификата"/);
  assert.doesNotMatch(source, /aria-label="Тип условия"/);
  assert.doesNotMatch(source, /aria-label="Сравнение условия"/);
  assert.doesNotMatch(source, /aria-label="Сумма условия"/);
});

test("custom offer conditions accept text-only rows without a numeric amount", async () => {
  const apiSource = await readFile(new URL("../app/api/admin/admin-api.ts", import.meta.url), "utf8");
  assert.match(apiSource, /"amount_value"/);
  assert.match(apiSource, /const nullableColumns = new Set\(\[[\s\S]*"amount_value"/);
});

test("media chooser is a real file label and uploads the selected file", () => {
  assert.match(source, /id="admin-media-file-input"/);
  assert.match(source, /onChange=\{\(event\) => handleMediaSelected/);
  assert.match(source, /prepareImageFile\(file\)/);
  assert.match(source, /uploadMedia\(normalized, field\)/);
  assert.match(source, /setPendingMediaFiles/);
  assert.equal((source.match(/accept="image\/\*"/g) ?? []).length, 3);
  assert.doesNotMatch(source, /accept="image\/jpeg,image\/png,image\/webp,image\/heic,image\/heif"/);
});

test("service editor persists structured pricing and duration", async () => {
  const adminApiSource = await readFile(new URL("../app/api/admin/admin-api.ts", import.meta.url), "utf8");
  assert.match(source, /duration_min_minutes/);
  assert.match(source, /duration_max_minutes/);
  assert.match(source, /Длительность услуги, минут/);
  assert.match(source, /body\.price_tiers_json = JSON\.stringify/);
  assert.match(adminApiSource, /result\.price_display_text = formatStoredPrice\(result\)/);
  assert.match(adminApiSource, /validateDuration\(result\)/);
  assert.match(adminApiSource, /result\.duration_text = `\$\{durationMin\} минут`/);
  assert.match(adminApiSource, /от 1 до 1440 минут/);
});

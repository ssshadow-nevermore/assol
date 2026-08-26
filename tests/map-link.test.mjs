import assert from "node:assert/strict";
import test from "node:test";

const { generateMapLinks, generateMapLinksAsync } = await import("../app/map-link.ts");

test("generates desktop and mobile widget URLs from a Yandex address link", () => {
  const result = generateMapLinks("https://yandex.ru/maps/10748/pushkino/?ll=37.8582615%2C56.002732&z=18&mode=poi");
  assert.deepEqual(result.coordinates, { longitude: 37.8582615, latitude: 56.002732 });
  assert.match(result.desktopUrl, /ll=37\.8478%2C56\.0027/);
  assert.match(result.desktopUrl, /pt=37\.8582615%2C56\.002732%2Cpm2rdm/);
  assert.match(result.mobileUrl, /ll=37\.8582615%2C55\.997/);
  assert.match(result.mobileUrl, /pt=37\.8582615%2C56\.002732%2Cpm2rdm/);
});

test("prefers a marker point over the map viewport center", () => {
  const result = generateMapLinks("https://yandex.ru/maps/org/test/1/?ll=37.8%2C56.1&pt=37.9%2C56.2%2Cpm2rdm");
  assert.deepEqual(result.coordinates, { longitude: 37.9, latitude: 56.2 });
});

test("prefers an organization poi point over the map viewport center", () => {
  const result = generateMapLinks(
    "https://yandex.ru/maps/10748/pushkino/?ll=37.858764%2C56.002177&mode=poi&poi%5Bpoint%5D=37.858655%2C56.002526&poi%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D1089857323&z=18",
  );
  assert.deepEqual(result.coordinates, { longitude: 37.858655, latitude: 56.002526 });
});

test("rejects non-Yandex and coordinate-less links", () => {
  assert.throws(() => generateMapLinks("https://example.com/maps/?ll=37,56"), /ссылка на адрес из Яндекс Карт/i);
  assert.throws(() => generateMapLinks("https://yandex.ru/maps/10748/pushkino/"), /координаты/i);
});

test("resolves a Yandex short link and keeps the short source URL", async () => {
  const shortUrl = "https://yandex.ru/maps/-/CTwtFG~a";
  let calls = 0;
  const result = await generateMapLinksAsync(shortUrl, async () => {
    calls += 1;
    return calls === 1
      ? new Response(null, { status: 302, headers: { location: "https://yandex.ru/maps/10748/pushkino/house/?ll=37.858546%2C56.002402&z=16.91" } })
      : new Response(null, { status: 200 });
  });
  assert.equal(result.sourceUrl, shortUrl);
  assert.deepEqual(result.coordinates, { longitude: 37.858546, latitude: 56.002402 });
  assert.match(result.desktopUrl, /pt=37\.858546%2C56\.002402%2Cpm2rdm/);
});

test("does not follow a short link redirect to a non-Yandex host", async () => {
  await assert.rejects(
    () => generateMapLinksAsync("https://yandex.ru/maps/-/short", async () => new Response(null, {
      status: 302,
      headers: { location: "https://example.com/maps/?ll=37.8%2C56.1" },
    })),
    /Яндекс Карт/i,
  );
});

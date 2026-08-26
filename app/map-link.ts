export type MapCoordinates = {
  longitude: number;
  latitude: number;
};

export type GeneratedMapLinks = {
  sourceUrl: string;
  coordinates: MapCoordinates;
  desktopUrl: string;
  mobileUrl: string;
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const YANDEX_MAP_HOSTS = new Set([
  "yandex.ru",
  "yandex.com",
  "yandex.kz",
  "yandex.by",
  "yandex.uz",
  "yandex.com.tr",
]);

// Keep the existing visual template: on desktop the marker is to the right
// of the copy panel, while on mobile it is above the copy panel. The deltas
// are taken from the current iframe URLs and applied to any new location.
const MAP_ZOOM = 15;
const DESKTOP_CENTER_DELTA = { longitude: -0.0104615, latitude: -0.000032 };
const MOBILE_CENTER_DELTA = { longitude: 0, latitude: -0.005732 };

function isYandexHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return YANDEX_MAP_HOSTS.has(host) || host.startsWith("maps.") && host.endsWith(".yandex.ru");
}

function decode(value: string): string {
  let current = value;
  for (let index = 0; index < 3; index += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) return current;
      current = next;
    } catch {
      return current;
    }
  }
  return current;
}

function coordinatePair(value: string | null): MapCoordinates | null {
  if (!value) return null;
  const match = decode(value).match(/(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const longitude = Number(match[1]);
  const latitude = Number(match[2]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null;
  return { longitude, latitude };
}

function roundCoordinate(value: number): string {
  return value.toFixed(7).replace(/0+$/, "").replace(/\.$/, "");
}

function widgetUrl(coordinates: MapCoordinates, delta: { longitude: number; latitude: number }): string {
  const centerLongitude = coordinates.longitude + delta.longitude;
  const centerLatitude = coordinates.latitude + delta.latitude;
  const query = new URLSearchParams({
    ll: `${roundCoordinate(centerLongitude)},${roundCoordinate(centerLatitude)}`,
    z: String(MAP_ZOOM),
    pt: `${roundCoordinate(coordinates.longitude)},${roundCoordinate(coordinates.latitude)},pm2rdm`,
  });
  return `https://yandex.ru/map-widget/v1/?${query.toString()}`;
}

function generatedLinks(sourceUrl: string, coordinates: MapCoordinates): GeneratedMapLinks {
  return {
    sourceUrl,
    coordinates,
    desktopUrl: widgetUrl(coordinates, DESKTOP_CENTER_DELTA),
    mobileUrl: widgetUrl(coordinates, MOBILE_CENTER_DELTA),
  };
}

function assertYandexAddressUrl(value: string, allowWidget = false): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Вставьте корректную ссылку на адрес в Яндекс Картах");
  }
  if (parsed.protocol !== "https:" || !isYandexHost(parsed.hostname) || !/maps/i.test(parsed.pathname)) {
    throw new Error("Нужна ссылка на адрес из Яндекс Карт");
  }
  if (/map-widget/i.test(parsed.pathname) && !allowWidget) {
    throw new Error("Вставьте ссылку на адрес из Яндекс Карт, а не ссылку виджета");
  }
  return parsed;
}

/**
 * Extract coordinates from a Yandex URL. The widget form is only accepted
 * internally when recovering coordinates from the legacy stored map URL;
 * admins must still paste an address URL in the editor.
 */
export function extractMapCoordinates(value: string, options: { allowWidget?: boolean } = {}): MapCoordinates {
  const sourceUrl = value.trim();
  const parsed = assertYandexAddressUrl(sourceUrl, options.allowWidget);

  const coordinates = [
    parsed.searchParams.get("pt"),
    parsed.searchParams.get("poi[point]"),
    parsed.searchParams.get("ll"),
    parsed.searchParams.get("whatshere[point]"),
    parsed.searchParams.get("whatshere"),
    parsed.searchParams.get("rtext"),
  ].map(coordinatePair).find((item): item is MapCoordinates => item !== null)
    ?? coordinatePair(parsed.toString());
  if (!coordinates) {
    throw new Error("В ссылке не найдены координаты. Скопируйте полную ссылку на адрес из Яндекс Карт");
  }
  return coordinates;
}

/**
 * Extract coordinates from a full Yandex Maps address URL. Short redirect
 * links without coordinates are rejected deliberately: resolving redirects
 * or geocoding an address would make saving dependent on an external service.
 */
export function generateMapLinks(value: string): GeneratedMapLinks {
  const sourceUrl = value.trim();
  return generatedLinks(sourceUrl, extractMapCoordinates(sourceUrl));
}

export function generateMapLinksFromCoordinates(sourceUrl: string, coordinates: MapCoordinates): GeneratedMapLinks {
  return generatedLinks(sourceUrl.trim(), coordinates);
}

/**
 * Resolve Yandex's short /maps/-/... links on the server. The original short
 * URL is kept for the route button, while coordinates are taken only from a
 * validated Yandex redirect target. External hosts and widget URLs are never
 * followed or accepted as address sources.
 */
export async function generateMapLinksAsync(value: string, fetcher: FetchLike = fetch): Promise<GeneratedMapLinks> {
  const sourceUrl = value.trim();
  try {
    return generateMapLinks(sourceUrl);
  } catch (error) {
    if (!(error instanceof Error) || !/координаты/i.test(error.message)) throw error;
  }

  assertYandexAddressUrl(sourceUrl);
  let currentUrl = sourceUrl;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetcher(currentUrl, { method: "GET", redirect: "manual" });
    const location = response.headers.get("location");
    if (location && response.status >= 300 && response.status < 400) {
      const nextUrl = new URL(location, currentUrl).toString();
      assertYandexAddressUrl(nextUrl);
      currentUrl = nextUrl;
      continue;
    }

    const finalUrl = response.url || currentUrl;
    try {
      return generateMapLinksFromCoordinates(sourceUrl, extractMapCoordinates(finalUrl));
    } catch (finalError) {
      if (finalError instanceof Error && /координаты/i.test(finalError.message)) {
        throw new Error("Не удалось получить координаты из короткой ссылки Яндекс Карт");
      }
      throw finalError;
    }
  }
  throw new Error("Ссылка Яндекс Карт перенаправляет слишком много раз");
}

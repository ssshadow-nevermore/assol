import { assertAdminRequest, AdminApiError, errorResponse, jsonResponse, readJsonRecord } from "../admin-api";
import { getSqliteDatabase } from "../../../../db/sqlite";
import { extractMapCoordinates, generateMapLinksAsync, generateMapLinksFromCoordinates } from "../../../map-link";

type MapLinkRow = { id: string; link_key: string; url: string };

export async function POST(request: Request): Promise<Response> {
  try {
    await assertAdminRequest(request);
    const input = await readJsonRecord(request);
    const sourceUrl = typeof input.source_url === "string" ? input.source_url : "";
    const database = getSqliteDatabase();

    const existing = await database.prepare(
      "SELECT id, link_key, url FROM external_links WHERE link_key IN (?, ?, ?)",
    ).bind("yandex_maps", "yandex_map_widget_desktop", "yandex_map_widget_mobile").all<MapLinkRow>();
    const byKey = new Map(existing.results.map((row) => [row.link_key, row]));
    for (const key of ["yandex_maps", "yandex_map_widget_desktop", "yandex_map_widget_mobile"]) {
      if (!byKey.has(key)) throw new AdminApiError(`Ссылка карты «${key}» не настроена`, 503);
    }

    let generated;
    try {
      generated = await generateMapLinksAsync(sourceUrl);
    } catch (error) {
      // The original seed used a short organization URL without coordinates.
      // Saving that unchanged value is safe only when we can recover the
      // existing marker from the already configured desktop widget. A new
      // coordinate-less address is still rejected rather than guessed.
      const existingSource = byKey.get("yandex_maps");
      const existingDesktop = byKey.get("yandex_map_widget_desktop");
      const isLegacySource = existingSource?.url === sourceUrl && error instanceof Error && /координаты/i.test(error.message);
      if (!isLegacySource || !existingDesktop) throw error;
      generated = generateMapLinksFromCoordinates(sourceUrl, extractMapCoordinates(existingDesktop.url, { allowWidget: true }));
    }

    await database.batch([
      database.prepare("UPDATE external_links SET url = ?, updated_at = CURRENT_TIMESTAMP WHERE link_key = ?").bind(generated.sourceUrl, "yandex_maps"),
      database.prepare("UPDATE external_links SET url = ?, updated_at = CURRENT_TIMESTAMP WHERE link_key = ?").bind(generated.desktopUrl, "yandex_map_widget_desktop"),
      database.prepare("UPDATE external_links SET url = ?, updated_at = CURRENT_TIMESTAMP WHERE link_key = ?").bind(generated.mobileUrl, "yandex_map_widget_mobile"),
    ]);

    return jsonResponse({
      source_url: generated.sourceUrl,
      coordinates: generated.coordinates,
      desktop_url: generated.desktopUrl,
      mobile_url: generated.mobileUrl,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

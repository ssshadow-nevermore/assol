export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_DECLARED_IMAGE_TYPES = new Set(["", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

export class MediaValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "MediaValidationError";
  }
}

export function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "image/png";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp") {
    const brands = new TextDecoder().decode(bytes.slice(8, Math.min(bytes.length, 64)));
    if (/heic|heix|hevc|hevx/i.test(brands)) return "image/heic";
    if (/mif1|msf1/i.test(brands)) return "image/heif";
  }
  return null;
}

function extensionFor(type: string): string {
  return type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
}

function detectVideoType(bytes: Uint8Array): string | null {
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp") return "video/mp4";
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "video/webm";
  return null;
}

async function readArrayBufferWithTimeout(file: { arrayBuffer(): Promise<ArrayBuffer> }, timeoutMs = 15_000): Promise<ArrayBuffer> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      file.arrayBuffer(),
      new Promise<ArrayBuffer>((_, reject) => { timer = setTimeout(() => reject(new MediaValidationError("Не удалось прочитать файл вовремя")), timeoutMs); }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function validateImageFile(file: { size: number; type: string; arrayBuffer(): Promise<ArrayBuffer> }): Promise<{ bytes: ArrayBuffer; contentType: string; extension: string }> {
  if (file.size < 0 || file.size > MAX_IMAGE_BYTES) throw new MediaValidationError("Изображение должно быть размером от 1 байта до 8 МБ");
  const declaredType = String(file.type ?? "").toLowerCase();
  if (!ALLOWED_DECLARED_IMAGE_TYPES.has(declaredType)) throw new MediaValidationError("Разрешены только JPEG, PNG и WebP");
  const bytes = new Uint8Array(await readArrayBufferWithTimeout(file));
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_IMAGE_BYTES) throw new MediaValidationError("Изображение должно быть размером от 1 байта до 8 МБ");
  const detectedType = detectImageType(bytes);
  // HEIC/HEIF must be converted in the browser because the public image
  // pipeline and object storage contract intentionally remain JPEG/PNG/WebP.
  if (detectedType === "image/heic" || detectedType === "image/heif") throw new MediaValidationError("Формат HEIC/HEIF нужно преобразовать в JPEG перед загрузкой");
  if (!detectedType || !ALLOWED_TYPES.has(detectedType)) throw new MediaValidationError("Тип файла не соответствует содержимому изображения");
  return { bytes: new Uint8Array(bytes).buffer, contentType: detectedType, extension: extensionFor(detectedType) };
}

export async function validateVideoFile(file: { size: number; type: string; arrayBuffer(): Promise<ArrayBuffer> }): Promise<{ bytes: ArrayBuffer; contentType: string; extension: string }> {
  if (file.size < 0 || file.size > MAX_VIDEO_BYTES) throw new MediaValidationError("Видео должно быть размером от 1 байта до 50 МБ");
  if (!ALLOWED_VIDEO_TYPES.has(file.type)) throw new MediaValidationError("Разрешены только MP4 и WebM");
  const bytes = new Uint8Array(await readArrayBufferWithTimeout(file));
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_VIDEO_BYTES) throw new MediaValidationError("Видео должно быть размером от 1 байта до 50 МБ");
  const detectedType = detectVideoType(bytes);
  if (!detectedType || detectedType !== file.type) throw new MediaValidationError("Тип файла не соответствует содержимому видео");
  return { bytes: new Uint8Array(bytes).buffer, contentType: detectedType, extension: detectedType === "video/mp4" ? "mp4" : "webm" };
}

export function assertSafeRecordId(id: string): string {
  // Database content IDs use a namespace separator (for example
  // `portfolio:color-refresh`). It is safe as a query value and is kept
  // distinct from storage-key path segments below.
  if (!/^[a-zA-Z0-9:_-]+$/.test(id) || id.includes("..")) throw new MediaValidationError("Некорректный id записи");
  return id;
}

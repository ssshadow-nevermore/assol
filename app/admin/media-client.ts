/**
 * Normalize images selected from browser file pickers before they enter the
 * common upload flow. iOS Photos may expose the same asset as HEIC/HEIF,
 * with an empty MIME type, or with a MIME type that does not match its
 * extension. We use the bytes as the source of truth and hand the API a
 * browser-safe JPEG/PNG/WebP File.
 */

export const CLIENT_IMAGE_READ_TIMEOUT_MS = 15_000;
export const CLIENT_IMAGE_DECODE_TIMEOUT_MS = 20_000;
export const CLIENT_MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export type NormalizedImageType = "image/jpeg" | "image/png" | "image/webp";
type DetectedImageType = NormalizedImageType | "image/heic" | "image/heif" | "image/avif";
type ConvertibleImageType = "image/heic" | "image/heif" | "image/avif";

type ImageFileLike = {
  size: number;
  type: string;
  name?: string;
  lastModified?: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export class ImagePreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImagePreparationError";
  }
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function isoBmffBrands(bytes: Uint8Array): string[] {
  if (bytes.length < 12 || ascii(bytes, 4, 8) !== "ftyp") return [];
  const brands = [ascii(bytes, 8, 12).toLowerCase()];
  for (let offset = 16; offset + 4 <= Math.min(bytes.length, 64); offset += 4) {
    brands.push(ascii(bytes, offset, offset + 4).toLowerCase());
  }
  return brands;
}

/** Detect the actual image container. The filename and declared MIME are not trusted. */
export function detectImageType(bytes: Uint8Array): DetectedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "image/png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";

  // HEIF/HEIC and AVIF are ISO-BMFF containers. Inspect the major brand and
  // compatible brands as four-byte entries instead of matching arbitrary text.
  // AVIF can use the generic mif1 major brand, so check it before HEIF.
  const brands = isoBmffBrands(bytes);
  if (brands.some((brand) => brand === "avif" || brand === "avis")) return "image/avif";
  if (brands.some((brand) => ["heic", "heix", "hevc", "hevx"].includes(brand))) return "image/heic";
  if (brands.some((brand) => ["heim", "heis", "mif1", "msf1"].includes(brand))) return "image/heif";
  return null;
}

function extensionFor(type: NormalizedImageType): string {
  return type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
}

function timeoutError(message: string): ImagePreparationError {
  return new ImagePreparationError(message);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => { timer = globalThis.setTimeout(() => reject(timeoutError(message)), timeoutMs); }),
    ]);
  } finally {
    if (timer !== undefined) globalThis.clearTimeout(timer);
  }
}

async function readBytes(file: ImageFileLike, timeoutMs: number): Promise<ArrayBuffer> {
  if (!Number.isFinite(file.size) || file.size < 0 || file.size > CLIENT_MAX_IMAGE_BYTES) {
    throw new ImagePreparationError("Файл слишком большой. Максимальный размер изображения — 15 МБ.");
  }
  const bytes = await withTimeout(file.arrayBuffer(), timeoutMs, "Не удалось прочитать изображение вовремя. Выберите файл ещё раз.");
  if (bytes.byteLength <= 0 || bytes.byteLength > CLIENT_MAX_IMAGE_BYTES) {
    throw new ImagePreparationError("Файл слишком большой. Максимальный размер изображения — 15 МБ.");
  }
  return bytes;
}

function imageFormatLabel(type: ConvertibleImageType): string {
  return type === "image/avif" ? "AVIF" : "HEIC/HEIF";
}

function reportDecodeDiagnostic(file: ImageFileLike, bytes: Uint8Array, detectedType: ConvertibleImageType, error: unknown): void {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return;
  const decoderError = error instanceof Error ? error : new Error(String(error));
  console.debug("[media-client] image decode failed", {
    name: file.name ?? "",
    type: file.type,
    size: file.size,
    lastModified: file.lastModified ?? 0,
    detectedType,
    brands: isoBmffBrands(bytes),
    errorName: decoderError.name,
    errorMessage: decoderError.message,
  });
}

async function decodeToJpeg(file: ImageFileLike, bytes: ArrayBuffer, timeoutMs: number, detectedType: ConvertibleImageType): Promise<File> {
  const formatLabel = imageFormatLabel(detectedType);
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new ImagePreparationError(`Формат ${formatLabel} не поддерживается в текущем окружении. Сохраните фото как JPEG и повторите попытку.`);
  }

  const source = new Blob([bytes], { type: detectedType });
  let bitmap: ImageBitmap | null = null;
  let image: HTMLImageElement | null = null;
  const objectUrl = URL.createObjectURL(source);
  try {
    if (typeof createImageBitmap === "function") {
      try {
        bitmap = await withTimeout(createImageBitmap(source), timeoutMs, "Изображение не удалось декодировать вовремя.");
      } catch {
        // Some browsers expose createImageBitmap but do not decode the source
        // format. Fall back to the native <img> decoder before reporting an
        // unsupported format.
        bitmap = null;
      }
    }
    if (!bitmap) {
      image = document.createElement("img");
      const element = image;
      element.decoding = "async";
      await withTimeout(new Promise<void>((resolve, reject) => {
          element.addEventListener("load", () => resolve(), { once: true });
          element.addEventListener("error", () => reject(new ImagePreparationError(`Не удалось декодировать изображение ${formatLabel}.`)), { once: true });
          element.src = objectUrl;
        }), timeoutMs, "Изображение не удалось декодировать вовремя.");
      if (typeof element.decode === "function") await withTimeout(element.decode(), timeoutMs, "Изображение не удалось декодировать вовремя.");
    }

    const width = bitmap?.width ?? image?.naturalWidth ?? 0;
    const height = bitmap?.height ?? image?.naturalHeight ?? 0;
    if (!width || !height) throw new ImagePreparationError("Не удалось определить размеры изображения.");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new ImagePreparationError("Браузер не поддерживает подготовку изображения.");
    if (bitmap) context.drawImage(bitmap, 0, 0);
    else if (image) context.drawImage(image, 0, 0);
    const jpeg = await withTimeout(new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new ImagePreparationError("Не удалось преобразовать изображение в JPEG.")), "image/jpeg", 0.92)), timeoutMs, "Преобразование изображения выполняется слишком долго.");
    if (jpeg.size > CLIENT_MAX_IMAGE_BYTES) throw new ImagePreparationError("Преобразованное изображение превышает 15 МБ");
    return new File([jpeg], "upload.jpg", { type: "image/jpeg", lastModified: file.lastModified ?? Date.now() });
  } catch (error) {
    reportDecodeDiagnostic(file, new Uint8Array(bytes), detectedType, error);
    if (error instanceof ImagePreparationError) throw error;
    throw new ImagePreparationError(`Не удалось преобразовать изображение ${formatLabel}. Сохраните фото как JPEG и повторите попытку.`);
  } finally {
    bitmap?.close();
    URL.revokeObjectURL(objectUrl);
  }
}

export async function prepareImageFile(file: File, options?: { readTimeoutMs?: number; decodeTimeoutMs?: number }): Promise<File> {
  const bytes = await readBytes(file, options?.readTimeoutMs ?? CLIENT_IMAGE_READ_TIMEOUT_MS);
  const detectedType = detectImageType(new Uint8Array(bytes));
  if (detectedType === "image/heic" || detectedType === "image/heif" || detectedType === "image/avif") {
    return decodeToJpeg(file, bytes, options?.decodeTimeoutMs ?? CLIENT_IMAGE_DECODE_TIMEOUT_MS, detectedType);
  }
  if (!detectedType) throw new ImagePreparationError("Тип файла не соответствует содержимому изображения");
  return new File([bytes], `upload.${extensionFor(detectedType)}`, { type: detectedType, lastModified: file.lastModified ?? Date.now() });
}

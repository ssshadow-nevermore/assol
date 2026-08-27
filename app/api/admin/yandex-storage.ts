const DEFAULT_ENDPOINT = "https://storage.yandexcloud.net";
const DEFAULT_REGION = "ru-central1";
const SERVICE = "s3";
const EMPTY_PAYLOAD_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export class YandexStorageError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "YandexStorageError";
    this.status = status;
  }
}

type StorageConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  region: string;
};

function encodeSegment(segment: string): string {
  return encodeURIComponent(segment);
}

export function isSafeStorageKey(key: string): boolean {
  return /^media\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9-]+\.(?:jpg|png|webp|mp4|webm)$/.test(key) && !key.includes("..") && !key.includes("\\");
}

function configFromEnv(env: Partial<Env> | undefined): StorageConfig {
  const accessKeyId = String(env?.YC_ACCESS_KEY_ID ?? "").trim();
  const secretAccessKey = String(env?.YC_SECRET_ACCESS_KEY ?? "").trim();
  const bucket = String(env?.YC_BUCKET_NAME ?? "").trim();
  if (!accessKeyId || !secretAccessKey || !bucket) throw new YandexStorageError("Yandex Object Storage credentials are not configured", 503);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]{1,61}[a-zA-Z0-9]$/.test(bucket)) throw new YandexStorageError("Yandex Object Storage bucket name is invalid", 503);
  const endpoint = String(env?.YC_ENDPOINT ?? DEFAULT_ENDPOINT).trim().replace(/\/+$/, "");
  let parsedEndpoint: URL;
  try { parsedEndpoint = new URL(endpoint); } catch { throw new YandexStorageError("Yandex Object Storage endpoint is invalid", 503); }
  if (parsedEndpoint.protocol !== "https:" || parsedEndpoint.hostname !== "storage.yandexcloud.net" || parsedEndpoint.pathname !== "/") {
    throw new YandexStorageError("Yandex Object Storage endpoint is invalid", 503);
  }
  const region = String(env?.YC_REGION ?? DEFAULT_REGION).trim();
  if (!/^[a-z0-9-]{2,32}$/.test(region)) throw new YandexStorageError("Yandex Object Storage region is invalid", 503);
  return { accessKeyId, secretAccessKey, bucket, endpoint, region };
}

function bytes(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).buffer;
}

function hex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), (item) => item.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: ArrayBuffer): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", value));
}

async function hmac(key: ArrayBuffer, value: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, bytes(value));
}

function amzTimestamp(date: Date): { date: string; timestamp: string } {
  const iso = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return { date: iso.slice(0, 8), timestamp: iso };
}

function objectUrl(config: StorageConfig, key: string): string {
  return `${config.endpoint}/${encodeSegment(config.bucket)}/${key.split("/").map(encodeSegment).join("/")}`;
}

function canonicalHeaderValue(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

async function fetchWithTimeout(request: Request, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function signedRequest(
  config: StorageConfig,
  method: "GET" | "PUT" | "DELETE",
  key: string,
  body: ArrayBuffer | undefined,
  contentType: string,
  now = new Date(),
): Promise<Request> {
  if (!isSafeStorageKey(key)) throw new YandexStorageError("Unsafe media storage key", 400);
  const { date, timestamp } = amzTimestamp(now);
  const url = objectUrl(config, key);
  const host = new URL(url).host;
  const payloadHash = body ? await sha256(body) : EMPTY_PAYLOAD_HASH;
  const headers = new Map<string, string>([
    ["content-type", contentType],
    ["host", host],
    ["x-amz-content-sha256", payloadHash],
    ["x-amz-date", timestamp],
  ]);
  const signedHeaders = Array.from(headers.keys()).sort().join(";");
  const canonicalHeaders = Array.from(headers.keys()).sort().map((name) => `${name}:${canonicalHeaderValue(headers.get(name) ?? "")}`).join("\n") + "\n";
  const canonicalUri = new URL(url).pathname;
  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${date}/${config.region}/${SERVICE}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${timestamp}\n${scope}\n${await sha256(bytes(canonicalRequest))}`;
  const dateKey = await hmac(bytes(`AWS4${config.secretAccessKey}`), date);
  const regionKey = await hmac(dateKey, config.region);
  const serviceKey = await hmac(regionKey, SERVICE);
  const signingKey = await hmac(serviceKey, "aws4_request");
  const signature = hex(await hmac(signingKey, stringToSign));
  const requestHeaders = new Headers();
  headers.forEach((value, name) => requestHeaders.set(name, value));
  requestHeaders.set("authorization", `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`);
  return new Request(url, { method, headers: requestHeaders, body });
}

/** Exposed for deterministic local tests; production callers use the helpers below. */
export async function createYandexS3Request(
  env: Partial<Env> | undefined,
  method: "GET" | "PUT" | "DELETE",
  key: string,
  body: ArrayBuffer | undefined,
  contentType: string,
  now = new Date(),
): Promise<Request> {
  return signedRequest(configFromEnv(env), method, key, body, contentType, now);
}

export async function putYandexObject(env: Partial<Env> | undefined, key: string, body: ArrayBuffer, contentType: string): Promise<void> {
  const config = configFromEnv(env);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchWithTimeout(await signedRequest(config, "PUT", key, body, contentType));
      if (response.ok) return;
      lastError = new YandexStorageError(`Yandex Object Storage upload failed (${response.status})`);
      // Object Storage can briefly reset or return a gateway error while a
      // newly written object is being routed. Retry only transient 5xx
      // responses; validation and authorization errors must fail immediately.
      if (response.status < 500 || attempt === 2) throw lastError;
    } catch (error) {
      lastError = error;
      if (attempt === 2) {
        throw new YandexStorageError(`Yandex Object Storage upload request failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new YandexStorageError("Yandex Object Storage upload failed");
}

export async function deleteYandexObject(env: Partial<Env> | undefined, key: string): Promise<void> {
  let response: Response;
  try {
    response = await fetchWithTimeout(await signedRequest(configFromEnv(env), "DELETE", key, undefined, "application/octet-stream"));
  } catch (error) {
    throw new YandexStorageError(`Yandex Object Storage delete request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok && response.status !== 404) throw new YandexStorageError(`Yandex Object Storage delete failed (${response.status})`);
}

export async function getYandexObject(env: Partial<Env> | undefined, key: string, timeoutMs = 15000): Promise<Response> {
  try {
    return await fetchWithTimeout(await signedRequest(configFromEnv(env), "GET", key, undefined, "application/octet-stream"), timeoutMs);
  } catch (error) {
    throw new YandexStorageError(`Yandex Object Storage read request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

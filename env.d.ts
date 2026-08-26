/** Server-side auth/media settings supplied by the active runtime environment. */
interface Env {
  NODE_ENV?: string;
  HOST?: string;
  PORT?: string;
  SQLITE_PATH?: string;
  DATABASE_PATH?: string;
  ADMIN_DEV_BYPASS?: string;
  ADMIN_OWNER_LOGIN?: string;
  ADMIN_OWNER_PASSWORD_VERIFIER?: string;
  ADMIN_DEVELOPER_LOGIN?: string;
  ADMIN_DEVELOPER_PASSWORD_VERIFIER?: string;
  AUTH_PASSWORD_PEPPER?: string;
  YC_ACCESS_KEY_ID: string;
  YC_SECRET_ACCESS_KEY: string;
  YC_BUCKET_NAME: string;
  YC_ENDPOINT?: string;
  YC_REGION?: string;
}

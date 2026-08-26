import AdminDashboard from "./AdminDashboard";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isLocalDevelopmentHostname, requireAdminSession } from "../api/admin/access";
import { getAuthRuntime } from "../api/admin/auth-runtime";

export const metadata = {
  title: "Администрирование · Ассоль",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost";
  const hostname = host.replace(/^\[/, "").split("]")[0].split(":")[0];
  // Do not trust forwarding headers for authentication decisions. Vinext's
  // local runtime provides the actual host; local
  // private hosts use HTTP while public hosts use HTTPS.
  const protocol = isLocalDevelopmentHostname(hostname) ? "http" : "https";
  const forwardedHeaders = new Headers();
  requestHeaders.forEach((value, key) => forwardedHeaders.set(key, value));
  const session = await requireAdminSession(new Request(`${protocol}://${host}/admin`, { headers: forwardedHeaders }), await getAuthRuntime());
  if (!session.ok) redirect("/admin/login?return_to=/admin");
  return <AdminDashboard />;
}

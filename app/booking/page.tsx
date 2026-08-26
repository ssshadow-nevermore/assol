import { redirect } from "next/navigation";
import { getSiteData } from "../site-data";

export default async function BookingRedirect() {
  const siteData = await getSiteData();
  redirect(siteData.links.dikidi_widget.url);
}

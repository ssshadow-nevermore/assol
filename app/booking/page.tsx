import { redirect } from "next/navigation";
import { DIKIDI_URL } from "../dikidi";

export default function BookingRedirect() {
  redirect(DIKIDI_URL);
}

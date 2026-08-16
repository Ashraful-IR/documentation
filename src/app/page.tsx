import { redirect } from "next/navigation";

export default function Home() {
  // No landing page — the app starts at the login screen. Authenticated
  // visitors get bounced through to /documentation by the auth layout.
  redirect("/login");
}

import { redirect } from "next/navigation";

/**
 * Plain-language overview:
 * This is the landing page. It automatically redirects users to the dashboard
 * so they can immediately access the main features of Fundly.
 */

export default function Home() {
  redirect("/dashboard");
}

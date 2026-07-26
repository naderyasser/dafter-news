import { redirect } from "next/navigation";

import { getMe } from "@/lib/api";

export const revalidate = 0;

/**
 * Gate for every /dashboard/* screen.
 *
 * The dashboard used to render for anyone who typed the URL. The API is now
 * staff-gated on its own, so a stranger would only ever see empty tables —
 * but an empty newsroom is still a confusing thing to serve. Check once here
 * and send everyone else to the login card instead.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();

  if (!me.authenticated) redirect("/login?next=/dashboard");
  if (!me.is_staff_member) redirect("/?denied=dashboard");

  return <>{children}</>;
}

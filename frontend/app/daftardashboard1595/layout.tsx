import { redirect } from "next/navigation";
import { DASHBOARD } from "@/lib/routes";

import { getMe } from "@/lib/api";

export const revalidate = 0;

/**
 * Keeps the newsroom out of search results.
 *
 * It is not listed in robots.txt on purpose — that file is public and would
 * announce the path (see app/robots.ts) — so the instruction travels with the
 * page itself instead. A crawler that somehow reaches it is told not to index
 * it and not to follow its links onward.
 */
export const metadata = { robots: { index: false, follow: false, nocache: true } };

/**
 * Gate for every newsroom screen (see lib/routes.ts for the path itself).
 *
 * The dashboard used to render for anyone who typed the URL. The API is now
 * staff-gated on its own, so a stranger would only ever see empty tables —
 * but an empty newsroom is still a confusing thing to serve. Check once here
 * and send everyone else to the login card instead.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();

  if (!me.authenticated) redirect(`/login?next=${DASHBOARD}`);
  if (!me.is_staff_member) redirect("/?denied=dashboard");

  return <>{children}</>;
}

/**
 * NB on the forced password change: the redirect for it lives in
 * ForcePasswordChange (mounted by DashboardShell), not here.
 *
 * A layout cannot see which route it is wrapping, so gating on
 * `must_change_password` at this level would bounce the password screen
 * itself — the one screen that clears the flag — and the account would be
 * stuck in a redirect loop with no way to fix it.
 */

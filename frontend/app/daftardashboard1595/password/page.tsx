import { redirect } from "next/navigation";
import { DASHBOARD } from "@/lib/routes";

import ChangePasswordForm from "@/components/dashboard/ChangePasswordForm";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getMe } from "@/lib/api";

export const revalidate = 0;

export const metadata = { title: "تغيير كلمة المرور", robots: { index: false, follow: false } };

/**
 * Where an invited account lands on its first sign-in.
 *
 * The dashboard layout sends anyone still holding an admin-issued password
 * here and refuses every other screen until it is replaced — a password that
 * was read aloud across a desk is good for exactly one login.
 *
 * Reachable deliberately too: anyone may change their own password from here
 * whenever they like, which is why it does not itself require the flag.
 */
export default async function ChangePasswordPage() {
  const me = await getMe();
  if (!me.authenticated) redirect(`/login?next=${DASHBOARD}/password`);

  return (
    <DashboardShell active="" breadcrumb="لوحة التحكم" title="تغيير كلمة المرور" allowWhilePasswordPending>
      <ChangePasswordForm forced={Boolean(me.must_change_password)} />
    </DashboardShell>
  );
}

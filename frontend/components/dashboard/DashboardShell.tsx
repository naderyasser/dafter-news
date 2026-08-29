import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { DASHBOARD } from "@/lib/routes";
import AdminTopbar from "@/components/dashboard/AdminTopbar";
import { getMe } from "@/lib/api";
import { redirect } from "next/navigation";

export default async function DashboardShell({
  active,
  breadcrumb,
  title,
  actions,
  children,
  allowWhilePasswordPending = false,
}: {
  active: string;
  breadcrumb: string;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Only the password screen sets this — see the redirect below. */
  allowWhilePasswordPending?: boolean;
}) {
  // The nav is drawn from the caller's own capabilities, so a كاتب never sees
  // a link to a screen that would bounce them. Read here rather than passed
  // in by every page: one fetch, already uncached, and no page can forget it.
  const me = await getMe();

  // An account still holding an admin-issued password gets one screen until
  // it chooses its own. Gated here rather than in the layout because a layout
  // cannot tell which route it wraps — it would bounce the password screen
  // itself and loop, with no way out of it.
  if (me.must_change_password && !allowWhilePasswordPending) redirect(`${DASHBOARD}/password`);

  return (
    <div dir="rtl" lang="ar" className="flex min-h-screen bg-surface font-dashboard-ar text-ink">
      <AdminSidebar active={active} permissions={me.permissions} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <div className="flex flex-col gap-6 p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-1 text-[13px] text-ink-3">{breadcrumb}</div>
              <div className="rule-accent ps-3.5">
                <h1 className="font-display-ar m-0 text-h2 font-extrabold text-ink">{title}</h1>
              </div>
            </div>
            {actions}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

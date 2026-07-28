import AdminSidebar from "@/components/dashboard/AdminSidebar";
import AdminTopbar from "@/components/dashboard/AdminTopbar";

export default function DashboardShell({
  active,
  breadcrumb,
  title,
  actions,
  children,
}: {
  active: string;
  breadcrumb: string;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div dir="rtl" lang="ar" className="flex min-h-screen bg-surface font-body-ar text-ink">
      <AdminSidebar active={active} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <div className="flex flex-col gap-6 p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-1 text-[12px] text-ink-3">{breadcrumb}</div>
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

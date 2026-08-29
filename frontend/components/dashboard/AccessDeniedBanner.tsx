import { CAPABILITY_LABELS } from "@/lib/dashboardAccess";
import type { Capability } from "@/lib/api";

/**
 * Why the reader is looking at the overview instead of the screen they asked
 * for. Rendered from `?denied=<capability>`, which the route guards set when
 * they bounce someone (see lib/dashboardAccess.ts).
 *
 * It names the screen and the role that opens it, because "ليس لديك صلاحية"
 * on its own leaves a new writer unsure whether they typed the URL wrong,
 * whether the page is broken, or whom to ask. This tells them which of the
 * three it is.
 */
export default function AccessDeniedBanner({ denied }: { denied?: string }) {
  if (!denied) return null;
  const label = CAPABILITY_LABELS[denied as Capability];
  if (!label) return null;

  const owner = denied === "users" || denied === "settings" ? "مدير الموقع" : "محرر";

  return (
    <div role="alert" className="rounded-card border border-brand bg-brand-tint px-4.5 py-3.5">
      <div className="mb-1 text-[14.5px] font-extrabold text-brand">لا تملك صلاحية الوصول</div>
      <p className="m-0 text-[14px] leading-[1.7] text-ink-2">
        صفحة «{label}» متاحة لحساب بصلاحية {owner}. تم رجوعك إلى لوحة التحكم — تواصل مع مدير الموقع إذا كنت
        تحتاج هذه الصلاحية.
      </p>
    </div>
  );
}

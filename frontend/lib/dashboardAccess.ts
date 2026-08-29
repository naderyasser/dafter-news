import { redirect } from "next/navigation";
import { DASHBOARD } from "@/lib/routes";

import { getMe, type Capability } from "@/lib/api";

/**
 * Route guard for a dashboard screen that not every role may open.
 *
 * Called at the top of the page's own server component, before it fetches
 * anything, so an unauthorised role never sees a flash of the screen or a
 * table full of refusals — they land back on the overview with a reason.
 *
 * This is the second lock, not the only one. The API refuses the same person
 * whatever the browser does (see backend/aldaftar/permissions.py); this
 * exists so the newsroom gets an explanation in Arabic instead of an empty
 * page, which is what a purely server-side refusal looks like from here.
 *
 * `getMe` reads with revalidate 0, so a role change takes effect on the
 * writer's next navigation rather than at the end of some cache window.
 */
export async function requireCapability(capability: Capability): Promise<void> {
  const me = await getMe();

  if (!me.authenticated) redirect(`/login?next=${DASHBOARD}`);
  if (!me.permissions?.[capability]) redirect(`${DASHBOARD}?denied=${capability}`);
}

/** Arabic label per capability — what the overview prints in the banner. */
export const CAPABILITY_LABELS: Record<Capability, string> = {
  articles: "المقالات",
  media: "مكتبة الوسائط",
  comments: "التعليقات",
  taxonomy: "الأقسام والوسوم",
  videos: "الفيديوهات",
  breaking: "الأخبار العاجلة",
  ads: "الإعلانات",
  ticker: "شريط الأسواق",
  feeds: "المصادر الخارجية",
  authors: "كتّاب الرأي",
  users: "المستخدمون والأدوار",
  settings: "إعدادات الموقع",
};

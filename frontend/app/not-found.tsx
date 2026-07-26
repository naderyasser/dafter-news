import Link from "next/link";

import MostReadList from "@/components/site/MostReadList";
import SiteShell from "@/components/site/SiteShell";
import { getArticles } from "@/lib/api";

export default async function NotFound() {
  const mostRead = await getArticles("?ordering=-views&page_size=5");

  return (
    <SiteShell lang="ar">
      <div className="mx-auto max-w-[600px] px-6 py-16 text-center">
        <div className="tnum font-display-ar text-[96px] font-extrabold leading-none text-brand">404</div>
        <h1 className="font-display-ar mb-2 mt-4 text-[24px] font-extrabold text-ink">هذه الصفحة غير موجودة</h1>
        <p className="mb-6 text-[15px] text-ink-3">ربما تم نقل الخبر أو حذفه، أو أن الرابط غير صحيح</p>
        <Link href="/" className="inline-block rounded-pill bg-brand px-7 py-3 text-[14px] font-bold text-paper no-underline hover:bg-brand-strong">
          العودة للرئيسية
        </Link>
      </div>
      <div className="mx-auto max-w-[480px] px-6 pb-12">
        <MostReadList lang="ar" items={mostRead.results.map((a) => ({ title: a.title, href: `/article/${a.slug}`, section: a.section_name }))} />
      </div>
    </SiteShell>
  );
}

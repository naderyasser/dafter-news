import Link from "next/link";
import { DASHBOARD } from "@/lib/routes";

import ArticlesTable from "@/components/dashboard/ArticlesTable";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getArticles, FRESH } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { ArticleStatus } from "@/lib/types";

export const revalidate = 0;

export default async function DashArticlesPage({ searchParams }: { searchParams: { saved?: string } }) {
  // DRF keeps only the last repeated `status=` param, so fetch each status
  // separately and merge — the dashboard needs the full mix, unlike the
  // public site's list endpoint which defaults to published-only.
  const statuses: ArticleStatus[] = ["published", "draft", "review", "scheduled", "rejected"];
  const perStatus = await Promise.all(statuses.map((s) => getArticles(`?status=${s}&page_size=50`, FRESH)));
  const all = perStatus.flatMap((p) => p.results);

  const rows = all.map((a) => ({
    id: a.id,
    title: a.title,
    section: a.section_name,
    author: a.author_name || "—",
    status: a.status,
    views: a.views,
    date: formatDate(a.published_at, "ar") || "—",
  }));

  return (
    <DashboardShell
      active="articles"
      breadcrumb="لوحة التحكم / المحتوى"
      title="المقالات"
      actions={
        <Link href={`${DASHBOARD}/articles/new`} className="rounded-lg bg-brand px-4.5 py-2.5 text-[14px] font-bold text-paper no-underline hover:bg-brand-strong">
          + مقال جديد
        </Link>
      }
    >
      <ArticlesTable rows={rows} justSaved={searchParams.saved === "1"} />
    </DashboardShell>
  );
}

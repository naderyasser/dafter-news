import ColumnistsManager from "@/components/dashboard/ColumnistsManager";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getAuthors, getArticles, FRESH } from "@/lib/api";

export const revalidate = 0;

export default async function DashOpinionPage() {
  const [authors, opinionArticles] = await Promise.all([
    getAuthors(FRESH),
    getArticles("?kind=opinion&page_size=50", FRESH),
  ]);

  return (
    <DashboardShell active="opinion" breadcrumb="لوحة التحكم / الوسائط" title="بالعقل والمنطق">
      <ColumnistsManager authors={authors.results} articles={opinionArticles.results} />
    </DashboardShell>
  );
}

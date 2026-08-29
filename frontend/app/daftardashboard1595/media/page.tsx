import DashboardShell from "@/components/dashboard/DashboardShell";
import MediaManager from "@/components/dashboard/MediaManager";
import { getArticles, getMediaAssets, FRESH } from "@/lib/api";

export const revalidate = 0;

export default async function DashMediaPage() {
  // The article list feeds the "الخبر المرتبط" picker in the metadata dialog.
  const [media, articles] = await Promise.all([
    getMediaAssets("?page_size=200"),
    getArticles("?page_size=200&ordering=-published_at", FRESH),
  ]);

  return (
    <DashboardShell active="media" breadcrumb="لوحة التحكم / الإدارة" title="الوسائط">
      <MediaManager
        assets={media.results}
        articles={articles.results.map((a) => ({ id: a.id, title: a.title, slug: a.slug }))}
      />
    </DashboardShell>
  );
}

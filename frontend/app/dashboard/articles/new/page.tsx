import ArticleEditorForm from "@/components/dashboard/ArticleEditorForm";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getSections } from "@/lib/api";

export const revalidate = 0;

export default async function NewArticlePage() {
  const sections = await getSections();
  return (
    <DashboardShell active="articles" breadcrumb="لوحة التحكم / المحتوى / المقالات" title="محرر المقال">
      <ArticleEditorForm initial={null} sections={sections.results.map((s) => ({ id: s.id, key: s.key, label: s.name_ar }))} />
    </DashboardShell>
  );
}

import ArticleEditorForm from "@/components/dashboard/ArticleEditorForm";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getAuthors, getSections } from "@/lib/api";

export const revalidate = 0;

export default async function NewArticlePage() {
  const [sections, authors] = await Promise.all([getSections(), getAuthors()]);
  return (
    <DashboardShell active="articles" breadcrumb="لوحة التحكم / المحتوى / المقالات" title="محرر المقال">
      <ArticleEditorForm
        initial={null}
        sections={sections.results.map((s) => ({ id: s.id, key: s.key, label: s.name_ar }))}
        authors={authors.results.map((a) => ({ id: a.id, username: a.username, name: a.name, title: a.title, avatar: a.avatar }))}
      />
    </DashboardShell>
  );
}

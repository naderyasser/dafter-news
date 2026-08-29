import { notFound } from "next/navigation";

import ArticleEditorForm from "@/components/dashboard/ArticleEditorForm";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getArticle, getAuthors, getSections } from "@/lib/api";

export const revalidate = 0;

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const _params = await params;
  const [article, sections, authors] = await Promise.all([getArticle(_params.id), getSections(), getAuthors()]);
  if (!article) notFound();

  return (
    <DashboardShell active="articles" breadcrumb="لوحة التحكم / المحتوى / المقالات" title="محرر المقال">
      <ArticleEditorForm
        initial={article}
        articleId={article.id}
        sections={sections.results.map((s) => ({ id: s.id, key: s.key, label: s.name_ar }))}
        authors={authors.results.map((a) => ({ id: a.id, username: a.username, name: a.name, title: a.title, avatar: a.avatar }))}
      />
    </DashboardShell>
  );
}

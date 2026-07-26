import { notFound } from "next/navigation";

import ArticleEditorForm from "@/components/dashboard/ArticleEditorForm";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getArticle, getSections } from "@/lib/api";

export const revalidate = 0;

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const [article, sections] = await Promise.all([getArticle(params.id), getSections()]);
  if (!article) notFound();

  return (
    <DashboardShell active="articles" breadcrumb="لوحة التحكم / المحتوى / المقالات" title="محرر المقال">
      <ArticleEditorForm initial={article} articleId={article.id} sections={sections.results.map((s) => ({ id: s.id, key: s.key, label: s.name_ar }))} />
    </DashboardShell>
  );
}

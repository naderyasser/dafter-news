import CommentsManager from "@/components/dashboard/CommentsManager";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getComments } from "@/lib/api";

export const revalidate = 0;

export default async function DashCommentsPage() {
  const comments = await getComments("?page_size=100");
  return (
    <DashboardShell active="comments" breadcrumb="لوحة التحكم / التفاعل" title="التعليقات">
      <CommentsManager comments={comments.results} />
    </DashboardShell>
  );
}

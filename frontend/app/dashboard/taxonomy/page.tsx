import DashboardShell from "@/components/dashboard/DashboardShell";
import TaxonomyManager from "@/components/dashboard/TaxonomyManager";
import { getSections, getTags } from "@/lib/api";

export const revalidate = 0;

export default async function DashTaxonomyPage() {
  const [sections, tags] = await Promise.all([getSections(), getTags()]);
  return (
    <DashboardShell active="taxonomy" breadcrumb="لوحة التحكم / الإدارة" title="الأقسام والوسوم">
      <TaxonomyManager sections={sections.results} tags={tags.results} />
    </DashboardShell>
  );
}

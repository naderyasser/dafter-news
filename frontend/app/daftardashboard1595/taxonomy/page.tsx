import DashboardShell from "@/components/dashboard/DashboardShell";
import { requireCapability } from "@/lib/dashboardAccess";
import TaxonomyManager from "@/components/dashboard/TaxonomyManager";
import { getSections, getTags, FRESH } from "@/lib/api";

export const revalidate = 0;

export default async function DashTaxonomyPage() {
  await requireCapability("taxonomy");

  const [sections, tags] = await Promise.all([getSections(FRESH), getTags(FRESH)]);
  return (
    <DashboardShell active="taxonomy" breadcrumb="لوحة التحكم / الإدارة" title="الأقسام والوسوم">
      <TaxonomyManager sections={sections.results} tags={tags.results} />
    </DashboardShell>
  );
}

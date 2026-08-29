import DashboardShell from "@/components/dashboard/DashboardShell";
import { requireCapability } from "@/lib/dashboardAccess";
import UsersManager from "@/components/dashboard/UsersManager";
import { getUsers } from "@/lib/api";

export const revalidate = 0;

export default async function DashUsersPage() {
  await requireCapability("users");

  const users = await getUsers();
  return (
    <DashboardShell active="users" breadcrumb="لوحة التحكم / النظام" title="المستخدمون والأدوار">
      <UsersManager users={users.results} />
    </DashboardShell>
  );
}

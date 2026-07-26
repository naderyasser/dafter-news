import LoginForm from "@/components/site/LoginForm";
import SiteShell from "@/components/site/SiteShell";

export default function LoginPage() {
  return (
    <SiteShell lang="ar" active="login">
      <div className="flex justify-center px-6 py-16">
        <LoginForm />
      </div>
    </SiteShell>
  );
}

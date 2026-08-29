import { Suspense } from "react";

import LoginForm from "@/components/site/LoginForm";
import SiteShell from "@/components/site/SiteShell";

export const metadata = { title: "تسجيل الدخول", robots: { index: false, follow: true } };

export default function LoginPage() {
  return (
    <SiteShell lang="ar" active="login">
      <div className="flex justify-center px-6 py-16">
        {/* LoginForm reads ?next= via useSearchParams, which needs a boundary
            or the whole route opts out of static generation. */}
        <Suspense fallback={<div className="h-[420px] w-full max-w-[420px] rounded-card border border-line bg-paper" />}>
          <LoginForm />
        </Suspense>
      </div>
    </SiteShell>
  );
}

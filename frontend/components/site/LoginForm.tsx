"use client";

import { useState } from "react";

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-[420px] rounded-card border border-line bg-paper p-10 shadow-2">
      <div className="mb-2 border-s-[3px] border-brand ps-3.5">
        <h1 className="font-display-ar m-0 text-h2 font-extrabold text-ink">تسجيل الدخول</h1>
      </div>
      <p className="mb-6 text-[14px] text-ink-3">سجّل الدخول لمتابعة أخبارك واهتماماتك المفضلة</p>
      <label className="mb-1.5 block text-[13px] font-semibold text-ink-2">البريد الإلكتروني</label>
      <input
        type="email"
        placeholder="name@example.com"
        className="mb-4 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-brand focus:bg-paper"
      />
      <label className="mb-1.5 block text-[13px] font-semibold text-ink-2">كلمة المرور</label>
      <div className="relative mb-2">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 pe-10 text-[14px] text-ink outline-none focus:border-brand focus:bg-paper"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute end-2.5 top-1/2 -translate-y-1/2 border-none bg-none text-[14px] text-ink-3"
        >
          {showPassword ? "🙈" : "👁"}
        </button>
      </div>
      <div className="mb-5 text-end">
        <a href="#" className="text-[13px] font-semibold text-brand no-underline">
          نسيت كلمة المرور؟
        </a>
      </div>
      <button className="w-full rounded-pill bg-brand py-3 text-[15px] font-bold text-paper hover:bg-brand-strong">دخول</button>
      <p className="mt-5 text-center text-[13px] text-ink-3">
        ليس لديك حساب؟{" "}
        <a href="#" className="font-bold text-brand no-underline">
          إنشاء حساب جديد
        </a>
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";

import { apiMutate } from "@/lib/api";
import type { SiteSettings } from "@/lib/types";

const SOCIAL_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "facebook", label: "فيسبوك", placeholder: "facebook.com/aldaftarnews" },
  { key: "x", label: "X", placeholder: "x.com/aldaftarnews" },
  { key: "instagram", label: "إنستغرام", placeholder: "instagram.com/aldaftarnews" },
  { key: "youtube", label: "يوتيوب", placeholder: "youtube.com/@aldaftarnews" },
];

export default function SettingsManager({ initial }: { initial: SiteSettings | null }) {
  const [siteName, setSiteName] = useState(initial?.site_name ?? "الدفتر نيوز");
  const [tagline, setTagline] = useState(initial?.tagline ?? "سِجلّ اليوم.. خبراً خبراً");
  const [seoTitle, setSeoTitle] = useState(initial?.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(initial?.seo_description ?? "");
  const [langAr, setLangAr] = useState(initial?.lang_ar_enabled ?? true);
  const [langEn, setLangEn] = useState(initial?.lang_en_enabled ?? true);
  const [toastVisible, setToastVisible] = useState(false);

  const save = async () => {
    try {
      await apiMutate("/settings/", "PUT", {
        site_name: siteName,
        tagline,
        seo_title: seoTitle,
        seo_description: seoDescription,
        lang_ar_enabled: langAr,
        lang_en_enabled: langEn,
      });
    } catch {}
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const Switch = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <span onClick={onToggle} className={`relative h-5 w-9 cursor-pointer rounded-pill ${on ? "bg-brand" : "bg-line-strong"}`}>
      <span className="absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-[inset-inline-start] duration-fast" style={{ insetInlineStart: on ? "18px" : "2px" }} />
    </span>
  );

  return (
    <>
      <div className="flex max-w-[720px] flex-col gap-5">
        <div className="flex justify-end">
          <button onClick={save} className="rounded-lg bg-brand px-4.5 py-2.5 text-[13px] font-bold text-paper hover:bg-brand-strong">
            حفظ التغييرات
          </button>
        </div>
        <div className="flex flex-col gap-3.5 rounded-card border border-line bg-paper p-5">
          <div className="text-[15px] font-extrabold">هوية الموقع</div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="h-[72px] w-[72px] flex-shrink-0 rounded-lg bg-surface" />
            <div className="flex min-w-[200px] flex-1 flex-col gap-2.5">
              <input value={siteName} onChange={(e) => setSiteName(e.target.value)} className="rounded-lg border border-line px-3 py-2.5 text-[13.5px] outline-none focus:border-brand" />
              <input value={tagline} onChange={(e) => setTagline(e.target.value)} className="rounded-lg border border-line px-3 py-2.5 text-[13.5px] outline-none focus:border-brand" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 rounded-card border border-line bg-paper p-5">
          <div className="mb-1 text-[15px] font-extrabold">روابط التواصل الاجتماعي</div>
          {SOCIAL_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-2.5">
              <span className="w-[70px] text-[13px] text-ink-3">{f.label}</span>
              <input placeholder={f.placeholder} className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-brand" />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2.5 rounded-card border border-line bg-paper p-5">
          <div className="mb-1 text-[15px] font-extrabold">SEO الافتراضي</div>
          <input
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            placeholder="عنوان meta الافتراضي"
            className="rounded-lg border border-line px-3 py-2.5 text-[13.5px] outline-none focus:border-brand"
          />
          <textarea
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            placeholder="وصف meta الافتراضي"
            className="min-h-[60px] resize-y rounded-lg border border-line px-3 py-2.5 text-[13.5px] outline-none focus:border-brand"
          />
        </div>

        <div className="flex flex-col gap-3 rounded-card border border-line bg-paper p-5">
          <div className="text-[15px] font-extrabold">اللغات المفعّلة</div>
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-semibold">العربية</span>
            <Switch on={langAr} onToggle={() => setLangAr((v) => !v)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-semibold">English</span>
            <Switch on={langEn} onToggle={() => setLangEn((v) => !v)} />
          </div>
        </div>
      </div>

      {toastVisible && (
        <div className="fixed top-5 end-6 z-[70] rounded-lg bg-ink px-5 py-3 text-[13.5px] font-semibold text-paper shadow-2">✓ تم حفظ الإعدادات بنجاح</div>
      )}
    </>
  );
}

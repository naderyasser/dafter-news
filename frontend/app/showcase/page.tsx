import ArticleCard from "@/components/site/ArticleCard";
import SiteShell from "@/components/site/SiteShell";

const COLORS = [
  { name: "Brand", hex: "#B01F2E", bg: "bg-brand" },
  { name: "Brand Strong", hex: "#8E1624", bg: "bg-brand-strong" },
  { name: "Brand Tint", hex: "#FBEEEF", bg: "bg-brand-tint", border: true },
  { name: "Ink", hex: "#171A1F", bg: "bg-ink" },
  { name: "Ink-2", hex: "#3C434C", bg: "bg-ink-2" },
  { name: "Ink-3", hex: "#6A727C", bg: "bg-ink-3" },
  { name: "Surface", hex: "#F4F5F7", bg: "bg-surface", border: true },
  { name: "Header BG", hex: "#14171C", bg: "bg-header-bg" },
  { name: "Up", hex: "#0E8A4C", bg: "bg-up" },
  { name: "Down", hex: "#C93030", bg: "bg-down" },
];

const TYPE_SCALE = [
  { label: "Hero / 34px", cls: "font-display-ar text-hero font-extrabold" },
  { label: "H1 / 28px", cls: "font-display-ar text-h1 font-extrabold" },
  { label: "H2 / 22px", cls: "font-display-ar text-h2 font-bold" },
  { label: "H3 / 18px", cls: "font-display-ar text-h3 font-bold" },
  { label: "Body / 19px", cls: "text-body font-normal" },
  { label: "UI / 14px", cls: "text-ui font-semibold text-ink-2" },
];

const BUTTON_STATES = [
  { label: "Default", cls: "bg-brand text-paper" },
  { label: "Hover", cls: "bg-brand-strong text-paper" },
  { label: "Active", cls: "bg-brand-strong text-paper shadow-[inset_0_2px_4px_rgba(0,0,0,.25)]" },
  { label: "Disabled", cls: "bg-surface-2 text-header-muted cursor-not-allowed" },
  { label: "Outline", cls: "bg-paper text-ink border border-line" },
];

function SectionHead({ children }: { children: React.ReactNode }) {
  return <div className="font-display-ar mb-4 border-s-[3px] border-brand ps-3.5 text-[20px] font-extrabold text-ink">{children}</div>;
}

export default function ShowcasePage() {
  return (
    <SiteShell lang="ar">
      <div className="mx-auto flex max-w-container flex-col gap-10 px-6 py-8">
        <div className="border-s-[3px] border-brand ps-4">
          <h1 className="font-display-ar m-0 text-[28px] font-extrabold text-ink">Showcase — دليل المكونات المرئي</h1>
          <p className="mt-1.5 text-[14px] text-ink-3">مرجع بصري لكل مكونات الدفتر نيوز: الألوان، الطباعة، الشارات، الأزرار، الكروت، وحالات التحميل والفراغ</p>
        </div>

        <section>
          <SectionHead>الألوان</SectionHead>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {COLORS.map((c) => (
              <div key={c.name} className={`overflow-hidden rounded-card bg-paper ${c.border ? "border border-line" : "border border-line"}`}>
                <div className={`h-14 ${c.bg}`} />
                <div className="px-2.5 py-2">
                  <div className="text-xs font-bold">{c.name}</div>
                  <div dir="ltr" className="tnum text-end text-[11px] text-ink-3">
                    {c.hex}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHead>الطباعة</SectionHead>
          <div className="flex flex-col gap-3.5 rounded-card border border-line bg-paper p-5">
            {TYPE_SCALE.map((t) => (
              <div key={t.label} className="flex items-baseline gap-4 border-b border-line pb-3 last:border-b-0">
                <span className="w-[110px] flex-shrink-0 text-xs text-ink-3">{t.label}</span>
                <span className={t.cls}>نص تجريبي 123</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHead>الشارات</SectionHead>
          <div className="flex flex-wrap gap-3 rounded-card border border-line bg-paper p-5">
            <span className="rounded-badge bg-badge-breaking px-2.5 py-1 text-xs font-bold text-paper">عاجل</span>
            <span className="flex items-center gap-1.5 rounded-badge bg-badge-live px-2.5 py-1 text-xs font-bold text-paper">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-paper" />
              مباشر
            </span>
            <span className="rounded-badge bg-gold px-2.5 py-1 text-xs font-bold text-paper">خاص</span>
            <span className="tnum rounded-badge bg-[rgba(23,26,31,.75)] px-2 py-[3px] text-xs text-paper">05:44</span>
            <span className="rounded-pill bg-up-tint px-2.5 py-1 text-xs font-bold text-up">▲ 0.8%</span>
            <span className="rounded-pill bg-down-tint px-2.5 py-1 text-xs font-bold text-down">▼ 0.4%</span>
          </div>
        </section>

        <section>
          <SectionHead>الأزرار وحالاتها</SectionHead>
          <div className="flex flex-wrap items-center gap-3.5 rounded-card border border-line bg-paper p-5">
            {BUTTON_STATES.map((b) => (
              <div key={b.label} className="flex flex-col items-center gap-1.5">
                <button className={`rounded-pill px-6 py-2.5 text-[14px] font-bold ${b.cls}`}>دخول</button>
                <span className="text-[11px] text-ink-3">{b.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHead>التبويبات والترقيم</SectionHead>
          <div className="flex flex-col gap-4 rounded-card border border-line bg-paper p-5">
            <div className="flex gap-2">
              <span className="rounded-pill bg-brand px-4 py-2 text-[13px] font-semibold text-paper">الأحدث</span>
              <span className="rounded-pill border border-line bg-paper px-4 py-2 text-[13px] font-semibold text-ink">الأكثر قراءة</span>
            </div>
            <div className="flex gap-2">
              <span className="tnum flex h-9 w-9 items-center justify-center rounded-md bg-brand font-bold text-paper">١</span>
              <span className="tnum flex h-9 w-9 items-center justify-center rounded-md border border-line bg-paper font-bold text-ink">٢</span>
              <span className="tnum flex h-9 w-9 items-center justify-center rounded-md border border-line bg-paper font-bold text-ink">٣</span>
            </div>
          </div>
        </section>

        <section>
          <SectionHead>كروت الأخبار — كل الأنواع</SectionHead>
          <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
            <ArticleCard lang="ar" variant="standard" href="#" title="عنوان خبر قياسي بصورة كاملة" section="مصر" time="منذ ساعة" badge="breaking" />
            <ArticleCard
              lang="ar"
              variant="standard"
              href="#"
              title="كارت فيديو بشارة حصري ومدة"
              section="لقطة وتعليق"
              time="منذ ساعتين"
              badge="exclusive"
              isVideo
              videoDuration="04:12"
              comments={86}
            />
            <div className="rounded-card border border-line bg-paper p-3.5">
              <ArticleCard lang="ar" variant="compact" href="#" title="كارت مضغوط بصورة جانبية 120px" section="اقتصاد" time="منذ 3 ساعات" badge="none" />
            </div>
            <div className="rounded-card border border-line bg-paper p-3.5">
              <ArticleCard
                lang="ar"
                variant="text"
                href="#"
                title="كارت نصي بدون صورة وفاصل سفلي"
                time="منذ 4 ساعات"
                badge="none"
                excerpt="سطر توضيحي قصير يظهر أسفل العنوان في هذا النوع من الكروت."
              />
            </div>
          </div>
          <ArticleCard lang="ar" variant="hero" href="#" title="كارت Hero بخلفية كاملة وتدرج غامق" section="رياضة" time="منذ 30 دقيقة" badge="live" />
        </section>

        <section>
          <SectionHead>حالة التحميل (Skeleton)</SectionHead>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="overflow-hidden rounded-card border border-line bg-paper">
                <div className="aspect-video animate-skeleton bg-surface-2" />
                <div className="flex flex-col gap-2 p-3.5">
                  <div className="h-3 w-2/5 animate-skeleton rounded bg-surface-2" />
                  <div className="h-4 w-[90%] animate-skeleton rounded bg-surface-2" />
                  <div className="h-4 w-[70%] animate-skeleton rounded bg-surface-2" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHead>حالة الفراغ (Empty State)</SectionHead>
          <div className="rounded-card border border-dashed border-line-strong bg-paper p-12 text-center text-ink-3">
            <div className="mb-2.5 text-[32px]">🗂</div>
            <div className="mb-1 font-bold text-ink">لا توجد نتائج لعرضها</div>
            <div className="text-[13px]">جرّب تعديل الفلاتر أو كلمة البحث</div>
          </div>
        </section>

        <section>
          <SectionHead>خط هامش الدفتر (Signature)</SectionHead>
          <div className="flex flex-col gap-4 rounded-card border border-line bg-paper p-5">
            <div className="font-display-ar border-s-[3px] border-brand ps-3.5 font-extrabold">
              اللوجو وعناوين الأقسام وH2 والاقتباسات فقط — لا يُستخدم في أي مكان آخر
            </div>
            <blockquote className="m-0 border-s-[3px] border-brand ps-5 text-[18px] font-semibold text-ink-2">اقتباس بخط الهامش المميز</blockquote>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}

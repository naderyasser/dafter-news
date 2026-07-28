import MarketsTicker from "@/components/site/MarketsTicker";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import WelcomeToast from "@/components/site/WelcomeToast";
import { getTicker, getWelcomeAlert } from "@/lib/api";

/**
 * Shared public-site frame: header (3 layers + breaking marquee) → page
 * content → footer → sticky markets ticker. Every public page (brief §5)
 * reserves 52px at the bottom for the ticker via SiteFooter's pb-[52px].
 */
export default async function SiteShell({
  lang,
  active = "",
  children,
}: {
  lang: "ar" | "en";
  active?: string;
  children: React.ReactNode;
}) {
  const isAr = lang === "ar";
  const [ticker, welcome] = await Promise.all([getTicker(), getWelcomeAlert()]);
  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      lang={lang}
      className={`min-h-screen bg-surface text-ink ${isAr ? "font-body-ar" : "font-body-en"}`}
    >
      <SiteHeader lang={lang} active={active} />
      {children}
      <SiteFooter lang={lang} />
      <MarketsTicker lang={lang} data={ticker} />
      <WelcomeToast alert={welcome} lang={lang} />
    </div>
  );
}

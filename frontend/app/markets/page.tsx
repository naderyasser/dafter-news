import MarketsPageContent from "@/components/site/MarketsPageContent";
import SiteShell from "@/components/site/SiteShell";
import { getTicker } from "@/lib/api";

export const revalidate = 60;

export default async function MarketsPage() {
  const ticker = await getTicker();

  return (
    <SiteShell lang="ar" active="markets">
      <div className="mx-auto max-w-container px-6 py-8">
        <div className="mb-6 rule-accent ps-4">
          <h1 className="font-display-ar m-0 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] font-extrabold text-ink">الأسواق</h1>
        </div>
        <MarketsPageContent currencies={ticker.currencies} gold={ticker.gold} cities={ticker.cities} />
      </div>
    </SiteShell>
  );
}

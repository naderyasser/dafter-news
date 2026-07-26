import SiteShell from "@/components/site/SiteShell";

export default function AboutPage() {
  return (
    <SiteShell lang="ar" active="about">
      <div className="mx-auto max-w-reading px-6 py-12">
        <div className="mb-5 border-s-[3px] border-brand ps-4">
          <h1 className="font-display-ar m-0 text-[28px] font-extrabold text-ink">من نحن</h1>
        </div>
        <p className="mb-8 text-[17px] leading-[1.9] text-ink">
          الدفتر نيوز منصة إخبارية مستقلة تأسست بهدف تقديم تغطية دقيقة وسريعة لأخبار مصر والمنطقة، اقتصاداً ورياضة ومجتمعاً، مع التزام صارم
          بالمصدرية والتحقق قبل النشر.
        </p>
        <div className="mb-4 border-s-[3px] border-brand ps-4">
          <h2 className="font-display-ar m-0 text-[20px] font-extrabold text-ink">رسالتنا</h2>
        </div>
        <p className="mb-8 text-[17px] leading-[1.9] text-ink">
          نؤمن أن القارئ يستحق خبراً واضحاً بلا ضجيج، لذلك نفصل بين الخبر والرأي بوضوح، ونمنح كل قصة الوقت الكافي للتحقق قبل أن تصل إليك.
        </p>
        <div className="mb-4 border-s-[3px] border-brand ps-4">
          <h2 className="font-display-ar m-0 text-[20px] font-extrabold text-ink">تواصل معنا</h2>
        </div>
        <p className="text-[17px] leading-[1.9] text-ink">
          للاستفسارات والشراكات:{" "}
          <a href="mailto:info@aldaftarnews.com" className="font-semibold text-brand no-underline">
            info@aldaftarnews.com
          </a>
        </p>
      </div>
    </SiteShell>
  );
}

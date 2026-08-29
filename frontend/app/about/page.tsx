import SiteShell from "@/components/site/SiteShell";

export const metadata = { title: "من نحن", description: "عن الدفتر: هيئة التحرير، سياسة النشر، وطريقة التواصل مع غرفة الأخبار." };

export default function AboutPage() {
  return (
    <SiteShell lang="ar" active="about">
      <div className="mx-auto max-w-reading px-6 py-12">
        <div className="mb-5 rule-accent ps-4">
          <h1 className="font-display-ar m-0 text-[28px] font-extrabold text-ink">من نحن</h1>
        </div>
        <p className="mb-8 text-[17px] leading-[1.9] text-ink">
          الدفتر نيوز منصة إخبارية مستقلة تأسست بهدف تقديم تغطية دقيقة وسريعة لأخبار مصر والمنطقة، اقتصاداً ورياضة ومجتمعاً، مع التزام صارم
          بالمصدرية والتحقق قبل النشر.
        </p>
        <div className="mb-4 rule-accent ps-4">
          <h2 className="font-display-ar m-0 text-[20px] font-extrabold text-ink">رسالتنا</h2>
        </div>
        <p className="mb-8 text-[17px] leading-[1.9] text-ink">
          نؤمن أن القارئ يستحق خبراً واضحاً بلا ضجيج، لذلك نفصل بين الخبر والرأي بوضوح، ونمنح كل قصة الوقت الكافي للتحقق قبل أن تصل إليك.
        </p>
        <div className="mb-4 rule-accent ps-4">
          <h2 className="font-display-ar m-0 text-[20px] font-extrabold text-ink">تواصل معنا</h2>
        </div>
        <p className="text-[17px] leading-[1.9] text-ink">
          للاستفسارات والشراكات:{" "}
          <a href="mailto:aldaftarnews@gmail.com" className="font-semibold text-brand no-underline">
            aldaftarnews@gmail.com
          </a>
        </p>
        <p className="mt-10 border-t border-line pt-6 text-[14px] text-ink-3">
          تطوير الموقع:{" "}
          <a
            href="https://master.dev.educore.software/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand no-underline"
          >
            Master Development
          </a>
        </p>
      </div>
    </SiteShell>
  );
}

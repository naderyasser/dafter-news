"""
Populate the database with the same demo content used across the Claude
Design mocks (Home.dc.html, Article.dc.html, Section.dc.html, DashOverview,
DashArticles, ...) so every API endpoint returns real, on-brand data
instead of empty lists.

Idempotent: safe to re-run, existing rows are matched by natural keys
(slug / username / code / key) and updated in place.
"""
import datetime
import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.text import slugify

from ads.models import AdPlacement
from content.models import Article, ArticleBlock, BreakingNewsItem, Comment, Section, Story, Tag
from live.models import LiveStream, LiveUpdate
from market.models import Currency, GoldKarat, TickerModule, WeatherCity
from siteconfig.models import DailyVisit, SiteSettings, SocialLink
from video.models import Video, VideoComment

User = get_user_model()


def ar_slugify(value, fallback):
    """Arabic strings slugify to an EMPTY string under Django's default
    slugify (it strips every non-ASCII char), which would make every tag
    URL a meaningless `tag-0`, `tag-1`, ... — and silently return zero
    articles on /tag/<slug>. allow_unicode=True keeps the Arabic, so the
    tag URL reads /tag/الذهب (percent-encoded on the wire) and actually
    resolves. The fallback only fires for input with no word chars at all."""
    s = slugify(value, allow_unicode=True)
    return s or fallback


class Command(BaseCommand):
    help = "Seed the database with الدفتر نيوز demo content matching the design mocks."

    def handle(self, *args, **options):
        self.stdout.write("Seeding الدفتر نيوز demo data...")
        users = self.seed_users()
        sections = self.seed_sections()
        tags = self.seed_tags()
        self.seed_articles(sections, tags, users)
        self.seed_english_articles(sections, users)
        self.seed_comments()
        self.seed_breaking()
        self.seed_videos(sections)
        self.seed_live()
        self.seed_ads()
        self.seed_market()
        self.seed_site_settings()
        self.seed_daily_visits()
        self.seed_stories(sections)
        self.seed_welcome_alert()
        self.stdout.write(self.style.SUCCESS("Done."))

    # ------------------------------------------------------------------ users
    def seed_users(self):
        people = [
            ("m.eladawy", "محمد", "العدوي", User.Role.EDITOR, "محرر الشؤون المصرية"),
            ("s.farouk", "سامية", "فاروق", User.Role.AUTHOR, "كاتبة اقتصادية، الدفتر نيوز"),
            ("k.abdelwahab", "كريم", "عبد الوهاب", User.Role.AUTHOR, "محلل رياضي"),
            ("m.elsherbiny", "منى", "الشربيني", User.Role.AUTHOR, "محررة ثقافية"),
            ("a.labib", "أحمد", "لبيب", User.Role.AUTHOR, "كاتب تقنية وذكاء اصطناعي"),
            ("y.tawfik", "ياسمين", "توفيق", User.Role.MODERATOR, "مراسلة ميدانية"),
            ("admin", "أدمن", "النظام", User.Role.ADMIN, "مدير النظام"),
        ]
        created = {}
        for username, first, last, role, title in people:
            user, _ = User.objects.update_or_create(
                username=username,
                defaults=dict(
                    first_name=first, last_name=last, role=role, title=title,
                    bio=title, email=f"{username}@aldaftarnews.com", is_staff=role in (User.Role.ADMIN, User.Role.EDITOR),
                    is_superuser=(role == User.Role.ADMIN),
                ),
            )
            if not user.has_usable_password():
                user.set_password("aldaftar-demo")
                user.save()
            created[username] = user
        return created

    # --------------------------------------------------------------- sections
    def seed_sections(self):
        # The client's requested site map. `egypt`/`economy`/`sports` keep
        # their original keys so existing article links and seeded slugs stay
        # valid; the label is what changed (مصر → شؤون مصر, اقتصاد → حركة
        # السوق, رياضة → جوّه الجون).
        rows = [
            ("egypt", "شؤون مصر", "Egypt", 1),
            ("gulf", "الخليج العربي", "Gulf", 2),
            ("world", "عرب وعالم", "Arab & World", 3),
            ("economy", "حركة السوق", "Markets", 4),
            ("sports", "جوّه الجون", "Sports", 5),
            ("style", "ستايل ونجوم", "Style & Stars", 6),
            ("security", "أمن ومحاكم", "Security & Courts", 7),
            ("tech", "علوم وتكنولوجيا", "Science & Tech", 8),
            ("art", "ثقافة وفن", "Culture & Art", 9),
            ("special", "ملف خاص", "Special Report", 10),
            ("guide", "دليلك الأول", "Your Guide", 11),
            ("video", "لقطة وتعليق", "Watch", 12),
            ("opinion", "بالعقل والمنطق", "Opinion", 13),
        ]
        sections = {}
        for key, name_ar, name_en, order in rows:
            sec, _ = Section.objects.update_or_create(
                key=key, defaults=dict(name_ar=name_ar, name_en=name_en, order=order)
            )
            sections[key] = sec
        return sections

    # -------------------------------------------------------------------- tags
    def seed_tags(self):
        names = ["البنية التحتية", "الذهب", "كرة القدم", "المناخ", "التعليم", "الدلتا الجديدة", "الطاقة", "الانتخابات", "النقل", "سياسات عامة", "رأي"]
        tags = {}
        for n in names:
            tag, _ = Tag.objects.update_or_create(name=n, defaults=dict(slug=ar_slugify(n, f"tag-{len(tags)}")))
            tags[n] = tag
        return tags

    # --------------------------------------------------------------- articles
    def seed_articles(self, sections, tags, users):
        now = timezone.now()

        def mk_article(slug, title, section_key, author_key, standfirst, badge, status, views, hours_ago, kind="news", tag_names=None, blocks=None, subcategory=""):
            article, _ = Article.objects.update_or_create(
                slug=slug,
                defaults=dict(
                    title=title, kind=kind, section=sections.get(section_key), author=users.get(author_key),
                    language=Article.Language.AR, status=status, badge=badge, standfirst=standfirst,
                    subcategory=subcategory,
                    views=views, published_at=now - datetime.timedelta(hours=hours_ago) if status == "published" else None,
                ),
            )
            if tag_names:
                article.tags.set([tags[t] for t in tag_names if t in tags])
            if blocks:
                article.blocks.all().delete()
                for i, b in enumerate(blocks):
                    ArticleBlock.objects.create(article=article, order=i, **b)
            return article

        egypt_rows = [
            ("cabinet-incentives-small-factories", "مجلس الوزراء يوافق على حزمة حوافز جديدة للمصانع الصغيرة", "none", 1, 4120),
            ("desalination-plant-north-coast", "افتتاح أول محطة لتحلية مياه البحر على الساحل الشمالي", "exclusive", 2, 3660),
            ("cairo-governor-ramses-square", "محافظ القاهرة يتابع أعمال تطوير ميدان رمسيس", "none", 3, 2210),
            ("metro-helwan-line-expansion", "توسعات جديدة في شبكة المترو تشمل خط حلوان", "none", 4, 1870),
            ("health-ministry-early-detection", "وزارة الصحة تطلق مبادرة الكشف المبكر عن الأمراض المزمنة", "none", 22, 990),
            ("weather-warning-north-coast", "الأرصاد تحذر من رياح نشطة على السواحل الشمالية غداً", "none", 23, 640),
            ("handicrafts-initiative-saeed", "إطلاق مبادرة قومية لدعم الحرف اليدوية في الصعيد", "none", 26, 512),
            ("cairo-nairobi-protocol", "توقيع بروتوكول تعاون بين القاهرة ونيروبي", "none", 40, 380),
            ("desalination-plant-opens", "افتتاح أول محطة لتحلية مياه البحر", "none", 70, 2010),
        ]
        for slug, title, badge, hrs, views in egypt_rows:
            mk_article(slug, title, "egypt", "m.eladawy", title, badge, "published", views, hrs, tag_names=["البنية التحتية"])

        flagship_related = Article.objects.get(slug="cabinet-incentives-small-factories")
        flagship_blocks = [
            dict(type="paragraph", text="قال مسؤولون في وزارة النقل إن المرحلة الثانية من المحور الجديد تمتد لمسافة 48 كيلومتراً، وتشمل ثلاث كباري علوية وأربع محطات خدمة رئيسية على طول الطريق."),
            dict(type="image", caption="جانب من مراسم افتتاح المرحلة الثانية من المحور أمس", credit="الدفتر نيوز"),
            dict(type="paragraph", text="وأوضحت الوزارة أن العمل بدأ في المرحلة الثالثة والأخيرة من المشروع، والمقرر الانتهاء منها في الربع الأول من العام المقبل."),
            dict(type="heading", text="تفاصيل المشروع"),
            dict(type="paragraph", text="يأتي المشروع في إطار خطة الدولة لتطوير شبكة الطرق القومية، بتكلفة إجمالية تجاوزت 12 مليار جنيه."),
            dict(type="quote", text="هذا المحور ليس مجرد طريق.. إنه إعادة رسم لخريطة الحركة التجارية بين القاهرة والدلتا لعقود قادمة."),
            dict(type="related", text=flagship_related.title, related_article=flagship_related),
            dict(type="paragraph", text="من المتوقع أن يسهم المحور الجديد في خفض زمن الرحلة بين القاهرة والمنصورة من ساعتين ونصف إلى نحو 70 دقيقة فقط."),
        ]
        mk_article(
            "president-opens-delta-corridor", "الرئيس يفتتح المرحلة الثانية من محور الدلتا الجديد بتكلفة 12 مليار جنيه",
            "egypt", "m.eladawy", "المشروع يهدف إلى تقليص زمن الرحلة بين القاهرة والدلتا إلى النصف.",
            "breaking", "published", 18204, 0, tag_names=["البنية التحتية", "مصر" if "مصر" in tags else "النقل", "الدلتا الجديدة"],
            blocks=flagship_blocks,
        )

        econ_rows = [
            ("central-bank-holds-rate", "البنك المركزي يثبّت أسعار الفائدة للاجتماع الثالث على التوالي", "breaking", 1, 9410),
            ("pound-stable-third-week", "الجنيه يسجل استقراراً أمام الدولار للأسبوع الثالث", "none", 2, 3040),
            ("exchange-closes-higher", "بورصة مصر تغلق على ارتفاع بقيادة أسهم البنوك", "exclusive", 3, 2870),
            ("imf-praises-reform", "صندوق النقد يشيد ببرنامج الإصلاح الاقتصادي المصري", "none", 4, 1540),
            ("textile-exports-rise", "ارتفاع صادرات الغزل والنسيج 18% خلال النصف الأول", "none", 22, 980),
            ("car-import-duties", "قرار جديد بشأن رسوم استيراد السيارات", "none", 23, 870),
            ("gold-prices-rise-globally", "ارتفاع أسعار الذهب عالمياً مع تصاعد التوترات", "none", 25, 6120),
            ("fuel-price-rumors", "الحكومة ترد على شائعات رفع أسعار الوقود", "none", 40, 640),
            ("property-registry-platform", "إطلاق منصة رقمية موحدة لخدمات الشهر العقاري", "none", 41, 410),
        ]
        for slug, title, badge, hrs, views in econ_rows:
            mk_article(slug, title, "economy", "s.farouk", title, badge, "published", views, hrs, tag_names=["الذهب"])

        sports_rows = [
            ("ahly-reach-final", "الأهلي يتأهل لنهائي دوري أبطال أفريقيا بعد فوز كاسح", "breaking", 2, 8320),
            ("ahly-seal-midfielder", "الأهلي يحسم صفقة نجم الوسط قبل ساعات من إغلاق القيد", "exclusive", 3, 5410),
            ("zamalek-new-coach", "الزمالك يتعاقد مع مدرب جديد قبل بداية الموسم", "none", 4, 2210),
            ("national-team-qualifier", "المنتخب الوطني يستعد لمواجهة حاسمة في تصفيات المونديال", "none", 24, 3110),
            ("player-of-the-year", "نجم الكرة المصرية يفوز بجائزة أفضل لاعب في القارة", "none", 25, 1980),
            ("ahly-terji-summary", "ملخص مباراة الأهلي والترجي في أفريقيا", "none", 26, 31822),
        ]
        for slug, title, badge, hrs, views in sports_rows:
            mk_article(slug, title, "sports", "k.abdelwahab", title, badge, "published", views, hrs, tag_names=["كرة القدم"])

        # The rest of the site map. Without these the sections exist in the nav
        # but every one of their blocks renders empty, so the home page looks
        # like the site only covers مصر/اقتصاد/رياضة. «عرب وعالم» carries
        # subcategories because its block puts them on the photo as a red chip.
        gulf_rows = [
            ("gcc-summit-riyadh", "قمة خليجية في الرياض تبحث ملفات الطاقة والأمن الإقليمي", "none", 3, 4210),
            ("uae-egypt-investment-fund", "الإمارات ومصر توقّعان اتفاقاً لتأسيس صندوق استثماري مشترك", "exclusive", 6, 3180),
            ("kuwait-budget-surplus", "الكويت تعلن فائضاً في الموازنة للعام المالي الجاري", "none", 12, 1460),
            ("saudi-neom-phase", "السعودية تدشّن مرحلة جديدة من مشروع نيوم", "none", 20, 2740),
            ("qatar-gas-expansion", "قطر توسّع طاقتها الإنتاجية من الغاز المسال", "none", 28, 1190),
            ("bahrain-digital-economy", "البحرين تطلق استراتيجية الاقتصاد الرقمي 2030", "none", 34, 830),
        ]
        for slug, title, badge, hrs, views in gulf_rows:
            mk_article(slug, title, "gulf", "s.farouk", title, badge, "published", views, hrs, tag_names=["الطاقة"])

        world_rows = [
            ("un-assembly-climate-vote", "الجمعية العامة للأمم المتحدة تصوّت على قرار المناخ الجديد", "breaking", 1, 7620, "سياسة"),
            ("eu-migration-pact", "الاتحاد الأوروبي يقرّ حزمة إصلاحات في ملف الهجرة", "none", 4, 3410, "سياسة"),
            ("venice-biennale-arab-pavilion", "الجناح العربي يخطف الأنظار في بينالي فينيسيا", "none", 9, 2180, "ثقافة وفنون"),
            ("africa-trade-corridor", "إطلاق ممر تجاري جديد يربط شرق أفريقيا بالمتوسط", "exclusive", 15, 1970, "اقتصاد"),
            ("asia-summit-supply-chains", "قمة آسيوية تبحث إعادة رسم سلاسل الإمداد العالمية", "none", 21, 1520, "اقتصاد"),
            ("world-heritage-new-sites", "اليونسكو تضيف مواقع عربية جديدة لقائمة التراث العالمي", "none", 30, 2640, "ثقافة وفنون"),
            ("latin-america-elections", "انتخابات حاسمة في أمريكا اللاتينية تعيد ترتيب المشهد", "none", 38, 1130, "سياسة"),
        ]
        for slug, title, badge, hrs, views, sub in world_rows:
            mk_article(slug, title, "world", "m.elsherbiny", title, badge, "published", views, hrs, tag_names=["سياسات عامة"], subcategory=sub)

        style_rows = [
            ("cairo-fashion-week", "أسبوع القاهرة للموضة يعود بمشاركة مصممين عرب", "none", 7, 2310),
            ("actor-returns-to-theatre", "نجم مصري يعود إلى خشبة المسرح بعد غياب سنوات", "none", 16, 1840),
            ("summer-style-guide", "دليل إطلالات الصيف: الألوان الترابية تتصدّر", "none", 26, 960),
            ("red-carpet-highlights", "أبرز إطلالات السجادة الحمراء في مهرجان الجونة", "none", 33, 1520),
        ]
        for slug, title, badge, hrs, views in style_rows:
            mk_article(slug, title, "style", "a.labib", title, badge, "published", views, hrs, tag_names=["التعليم"])

        security_rows = [
            ("interior-ministry-network-bust", "الداخلية تضبط شبكة للاتجار غير المشروع في القاهرة", "none", 5, 5210),
            ("court-verdict-corruption-case", "محكمة الجنايات تصدر حكمها في قضية فساد كبرى", "none", 13, 3870),
            ("traffic-crackdown-campaign", "حملة مرورية موسّعة على الطرق السريعة", "none", 23, 1240),
            ("cybercrime-unit-report", "مباحث الإنترنت تكشف تفاصيل بلاغات النصب الإلكتروني", "exclusive", 31, 2090),
        ]
        for slug, title, badge, hrs, views in security_rows:
            mk_article(slug, title, "security", "k.abdelwahab", title, badge, "published", views, hrs, tag_names=["سياسات عامة"])

        special_rows = [
            ("file-water-security", "ملف: أمن المياه في مصر.. الأرقام والتحديات", "exclusive", 8, 6410),
            ("file-informal-economy", "ملف: الاقتصاد غير الرسمي.. كيف يُدمج في المنظومة؟", "none", 18, 3120),
            ("file-new-delta", "ملف: الدلتا الجديدة بعد ثلاث سنوات من الإطلاق", "none", 29, 2480),
        ]
        for slug, title, badge, hrs, views in special_rows:
            mk_article(slug, title, "special", "m.eladawy", title, badge, "published", views, hrs, tag_names=["الدلتا الجديدة"])

        guide_rows = [
            ("guide-school-registration", "دليلك الأول: خطوات تسجيل أبنائك في المدارس إلكترونياً", "none", 11, 4830),
            ("guide-property-registration", "دليلك الأول: أوراق الشهر العقاري ومواعيد التقديم", "none", 19, 2910),
            ("guide-driving-licence", "دليلك الأول: تجديد رخصة القيادة في خطوات", "none", 27, 3540),
            ("guide-health-insurance", "دليلك الأول: كيف تستفيد من التأمين الصحي الشامل؟", "none", 36, 1770),
        ]
        for slug, title, badge, hrs, views in guide_rows:
            mk_article(slug, title, "guide", "m.elsherbiny", title, badge, "published", views, hrs, tag_names=["التعليم"])

        tech_rows = [
            ("egypt-ai-strategy", "مصر تطلق استراتيجية وطنية للذكاء الاصطناعي", "none", 10, 3960),
            ("undersea-cable-landing", "تشغيل كابل بحري جديد يرفع سعة الإنترنت في مصر", "none", 17, 2150),
            ("space-agency-satellite", "وكالة الفضاء المصرية تستعد لإطلاق قمر صناعي جديد", "exclusive", 24, 2830),
            ("startups-funding-round", "شركات ناشئة مصرية تغلق جولات تمويل قياسية", "none", 32, 1420),
            ("solar-storage-breakthrough", "تقدّم بحثي في تخزين الطاقة الشمسية بجامعات مصرية", "none", 39, 1080),
        ]
        for slug, title, badge, hrs, views in tech_rows:
            mk_article(slug, title, "tech", "s.farouk", title, badge, "published", views, hrs, tag_names=["الطاقة"])

        art_rows = [
            ("cairo-book-fair-record", "معرض القاهرة للكتاب يسجّل رقماً قياسياً في عدد الزوار", "none", 14, 4270),
            ("national-theatre-season", "المسرح القومي يفتتح موسمه الجديد بعرض مصري خالص", "none", 25, 1930),
            ("museum-restoration-project", "انتهاء أعمال ترميم قاعة رئيسية بالمتحف المصري", "none", 35, 2560),
        ]
        for slug, title, badge, hrs, views in art_rows:
            mk_article(slug, title, "art", "a.labib", title, badge, "published", views, hrs, tag_names=["التعليم"])

        # Not-yet-published statuses so DashArticles / DashOverview show a mix.
        mk_article("ahly-midfielder-deal-scheduled", "الأهلي يحسم صفقة نجم الوسط قبل إغلاق القيد", "sports", "k.abdelwahab", "—", "none", "scheduled", 0, 0)
        mk_article("central-bank-behind-scenes", "تحقيق خاص: كواليس اجتماع البنك المركزي", "economy", "s.farouk", "تحقيق خاص", "none", "review", 0, 0)
        mk_article("technical-education-future", "حوار: مستقبل التعليم الفني في مصر", "egypt", "m.elsherbiny", "حوار خاص", "none", "review", 0, 0)
        mk_article("ai-in-newsrooms", "ملف: الذكاء الاصطناعي في غرف الأخبار", "opinion", "a.labib", "ملف خاص", "none", "review", 0, 0)
        mk_article("solar-energy-projects", "تقرير: مشروعات الطاقة الشمسية الجديدة", "egypt", "m.eladawy", "تقرير", "none", "review", 0, 0)
        mk_article("desalination-draft", "افتتاح أول محطة لتحلية مياه البحر", "egypt", "m.eladawy", "مسودة", "none", "draft", 0, 0)
        mk_article("solar-energy-rejected", "تقرير: مشروعات الطاقة الشمسية الجديدة - نسخة قديمة", "egypt", "m.eladawy", "—", "none", "rejected", 0, 0)

        # Opinion pieces (بالعقل والمنطق) — flagship gets full body blocks to match ArticleOpinion.dc.html.
        opinion_blocks = [
            dict(type="paragraph", text="حين نتحدث عن الإصلاح الاقتصادي، تتجه الأنظار عادة إلى الأرقام: سعر الصرف، عجز الموازنة، معدل التضخم. لكن الإصلاح الحقيقي أعمق من ذلك بكثير."),
            dict(type="heading", text="ما الذي تغيّر فعلاً؟"),
            dict(type="paragraph", text="خلال السنوات الأخيرة، تحسّنت مؤشرات كثيرة على الورق، لكن الشارع لا يزال يشعر بثقل الأسعار."),
            dict(type="quote", text="لا يمكن قياس نجاح الإصلاح بمؤشر بورصة، بل بقدرة أسرة على تعليم أبنائها دون قلق."),
            dict(type="paragraph", text="المطلوب اليوم ليس مزيداً من القرارات الصادمة، بل شبكة أمان اجتماعي تسير بالتوازي مع أي تعديل في الأسعار."),
        ]
        mk_article(
            "economic-reform-is-not-a-number", "الإصلاح الاقتصادي ليس رقماً في موازنة.. بل قرار مجتمع بأكمله",
            "opinion", "s.farouk", "الإصلاح الاقتصادي ليس رقماً في موازنة", "none", "published", 0, 24,
            kind="opinion", tag_names=["اقتصاد" if "اقتصاد" in tags else "رأي", "رأي", "سياسات عامة"],
            blocks=opinion_blocks,
        )
        opinion_rows = [
            ("why-national-team-loses", "لماذا يفوز المنتخب في الملعب الخطأ كل مرة؟", "k.abdelwahab", "review", 48),
            ("new-generation-of-readers", "جيل جديد من القراء.. وصحافة لم تتغيّر بعد", "m.elsherbiny", "published", 72),
            ("ai-threat-or-tool", "الذكاء الاصطناعي في غرفة الأخبار: تهديد أم أداة؟", "a.labib", "draft", 96),
            ("saeed-is-not-the-margin", "الصعيد ليس هامشاً.. هو متن الحكاية المصرية", "y.tawfik", "scheduled", 120),
        ]
        for slug, title, author_key, status, hrs in opinion_rows:
            mk_article(slug, title, "opinion", author_key, title, "none", status, 0, hrs, kind="opinion")

    # ------------------------------------------------------------- en articles
    def seed_english_articles(self, sections, users):
        """Home-EN.dc.html / Article-EN.dc.html demo content — brief §4/§12:
        'نسخة إنجليزية للرئيسية والمقال على الأقل'."""
        now = timezone.now()

        def mk_en(slug, title, section_key, author_key, standfirst, badge, hrs, views, blocks=None):
            article, _ = Article.objects.update_or_create(
                slug=slug,
                defaults=dict(
                    title=title, kind="news", section=sections.get(section_key), author=users.get(author_key),
                    language=Article.Language.EN, status="published", badge=badge, standfirst=standfirst,
                    views=views, published_at=now - datetime.timedelta(hours=hrs),
                ),
            )
            if blocks:
                article.blocks.all().delete()
                for i, b in enumerate(blocks):
                    ArticleBlock.objects.create(article=article, order=i, **b)
            return article

        egypt_related = mk_en(
            "cabinet-approves-incentives-en", "Cabinet approves new incentive package for small factories",
            "egypt", "m.eladawy", "Cabinet approves new incentive package for small factories", "none", 1, 4120,
        )
        mk_en(
            "president-opens-delta-corridor-en", "President Opens Second Phase of New Delta Corridor in $250M Push",
            "egypt", "m.eladawy", "The project aims to cut travel time between Cairo and the Delta in half, part of the state's plan to upgrade the national road and regional-corridor network.",
            "breaking", 0, 18204,
            blocks=[
                dict(type="paragraph", text="Transport ministry officials said the corridor's second phase spans 48 kilometers, including three overpasses and four service stations along the route."),
                dict(type="image", caption="The opening ceremony for the corridor's second phase yesterday", credit="Al Daftar News"),
                dict(type="paragraph", text="The ministry said work has begun on the project's third and final phase, due for completion in the first quarter of next year."),
                dict(type="heading", text="Project details"),
                dict(type="paragraph", text="The project is part of the state's plan to upgrade the national road network, with a total cost exceeding $250 million, jointly funded by the treasury and international lenders."),
                dict(type="quote", text="This corridor is not just a road — it redraws the map of trade movement between Cairo and the Delta for decades to come."),
                dict(type="related", text=egypt_related.title, related_article=egypt_related),
                dict(type="paragraph", text="The new corridor is expected to cut travel time between Cairo and Mansoura from two and a half hours to about 70 minutes, according to a technical study by the roads and bridges authority."),
            ],
        )
        rows = [
            ("desalination-plant-en", "First seawater desalination plant opens on North Coast", "egypt", "exclusive", 2, 3660),
            ("metro-helwan-line-en", "Metro network expansion to include Helwan line", "egypt", "none", 4, 1870),
            ("weather-warning-en", "Met office warns of strong winds on north coast tomorrow", "egypt", "none", 23, 640),
            ("central-bank-holds-rate-en", "Central Bank Holds Interest Rates Steady for Third Straight Meeting", "economy", "none", 1, 9410),
            ("pound-stable-en", "Pound holds steady against dollar for third week", "economy", "none", 2, 3040),
            ("exchange-closes-higher-en", "Egyptian exchange closes higher led by bank stocks", "economy", "exclusive", 3, 2870),
            ("imf-praises-reform-en", "IMF praises Egypt's economic reform program", "economy", "none", 4, 1540),
            ("ahly-seals-deal-en", "Al Ahly Seals Deal for Midfield Star Hours Before Deadline", "sports", "exclusive", 2, 5410),
            ("ahly-reach-final-en", "Al Ahly reach African Champions League final after crushing win", "sports", "none", 2, 8320),
            ("zamalek-new-coach-en", "Zamalek sign new coach ahead of new season", "sports", "none", 3, 2210),
        ]
        for slug, title, section_key, badge, hrs, views in rows:
            mk_en(slug, title, section_key, "m.eladawy", title, badge, hrs, views)

    # -------------------------------------------------------------- comments
    def seed_comments(self):
        by_slug = {
            "electric-car-plant-tour": [
                ("سارة أحمد", "تقرير رائع، أول مرة أشوف تفاصيل بهذا الشكل.", "pending"),
                ("عمر خالد", "هل فيه خطة لتصدير للسوق الأوروبي؟", "pending"),
            ],
            "president-opens-delta-corridor": [
                ("ندى محمود", "تغطية ممتازة كالعادة", "approved"),
            ],
            "ahly-midfielder-deal-scheduled": [
                ("زائر", "محتوى غير لائق تم الإبلاغ عنه", "banned"),
            ],
            "economic-reform-is-not-a-number": [
                ("إيمان علي", "رأي غير موضوعي في نظري", "approved"),
            ],
        }
        for slug, rows in by_slug.items():
            article = Article.objects.filter(slug=slug).first()
            if not article:
                continue
            for user_name, text, status in rows:
                Comment.objects.update_or_create(
                    article=article, user_name=user_name, text=text, defaults=dict(status=status)
                )
        central_bank = Article.objects.filter(slug="central-bank-behind-scenes").first()
        if central_bank:
            Comment.objects.update_or_create(
                article=central_bank, user_name="محمود سيد", text="خبر مهم، شكراً على المتابعة اللحظية",
                defaults=dict(status="pending"),
            )

    # --------------------------------------------------------------- breaking
    def seed_breaking(self):
        rows = [
            ("الرئيس يفتتح المرحلة الثانية من محور الدلتا الجديد", 1, True, 4),
            ("البنك المركزي يثبّت أسعار الفائدة في اجتماعه الدوري", 2, True, 6),
            ("المنتخب يتأهل لنهائي البطولة الأفريقية بعد فوز مثير", 3, False, 12),
            ("ارتفاع طفيف في أسعار الذهب مع تراجع الدولار عالمياً", 4, True, 24),
        ]
        for text, order, active, hrs in rows:
            BreakingNewsItem.objects.update_or_create(
                text=text, defaults=dict(order=order, active=active, expires_at=timezone.now() + datetime.timedelta(hours=hrs))
            )

    # ----------------------------------------------------------------- videos
    def seed_videos(self, sections):
        rows = [
            ("child-rescue-alexandria", "لحظة إنقاذ طفل من الغرق على شاطئ الإسكندرية", "egypt", 192, False, False, 4200,
             [("سارة أحمد", "تقرير رائع، أول مرة أشوف تفاصيل بهذا الشكل."), ("عمر خالد", "هل فيه خطة لتصدير للسوق الأوروبي؟")]),
            ("coach-reacts-performance", "تعليق الكابتن على أداء المنتخب في المباراة الأخيرة", "sports", 344, False, True, 11800),
            ("electric-car-plant-tour", "جولة داخل أكبر مصنع سيارات كهربائية في مصر", "economy", 440, False, False, 12480,
             [("سارة أحمد", "تقرير رائع، أول مرة أشوف تفاصيل خط الإنتاج بهذا الشكل."), ("عمر خالد", "هل فيه خطة لتصدير للسوق الأوروبي؟"), ("ندى محمود", "تغطية ممتازة كالعادة 👏")]),
            ("central-bank-conference-live", "تغطية حية لمؤتمر البنك المركزي", None, 0, True, False, 800),
            ("ahly-terji-highlights", "ملخص مباراة الأهلي والترجي في أفريقيا", "sports", 250, False, False, 20500),
            ("new-delta-corridor-tour", "جولة ميدانية داخل محور الدلتا الجديد", "egypt", 362, False, False, 5100),
        ]
        for slug, title, section_key, dur, is_live, is_exclusive, views, *rest in rows:
            video, _ = Video.objects.update_or_create(
                slug=slug,
                defaults=dict(
                    title=title, section=sections.get(section_key) if section_key else None,
                    duration_seconds=dur, is_live=is_live, is_exclusive=is_exclusive, views=views,
                ),
            )
            if rest:
                video.comments.all().delete()
                for name, text in rest[0]:
                    VideoComment.objects.create(video=video, name=name, text=text)

    # ------------------------------------------------------------------- live
    def seed_live(self):
        stream, _ = LiveStream.objects.update_or_create(
            title="تغطية لحظية: مؤتمر البنك المركزي حول أسعار الفائدة",
            defaults=dict(is_live=True),
        )
        stream.updates.all().delete()
        updates = [
            ("12:41", "محافظ البنك المركزي يبدأ كلمته بالإشارة إلى استقرار معدلات التضخم خلال الربع الأخير."),
            ("12:33", "بدء المؤتمر الصحفي بحضور نواب المحافظ وممثلي البنوك الكبرى."),
            ("12:20", "تجمع صحفي كبير أمام مقر البنك المركزي قبل بدء المؤتمر."),
            ("12:05", "مصادر: القرار المرتقب لن يشمل تغييراً في سعر الإيداع الليلي."),
            ("11:50", "انطلاق التغطية المباشرة لاجتماع لجنة السياسة النقدية."),
        ]
        for time_label, text in updates:
            LiveUpdate.objects.create(stream=stream, time_label=time_label, text=text)

    # -------------------------------------------------------------------- ads
    def seed_ads(self):
        rows = [
            ("أعلى الهيدر", "728×90", True, 128400, 612, 1),
            ("داخل متن المقال", "336×280", True, 84210, 940, 2),
            ("الشريط الجانبي", "300×600", True, 96500, 405, 3),
            ("بين بلوكات القسم", "728×90", False, 41200, 188, 4),
        ]
        for name, size, active, impressions, clicks, order in rows:
            AdPlacement.objects.update_or_create(
                name=name, size=size, defaults=dict(active=active, impressions=impressions, clicks=clicks, order=order)
            )

    # ----------------------------------------------------------------- market
    def seed_market(self):
        currencies = [
            ("🇺🇸", "USD", 48.70, 48.85, 0.3, True, [48.2, 48.3, 48.5, 48.4, 48.6, 48.7, 48.8, 48.85], 1),
            ("🇪🇺", "EUR", 51.90, 52.10, -0.15, False, [52.6, 52.5, 52.4, 52.3, 52.2, 52.2, 52.1, 52.1], 2),
            ("🇬🇧", "GBP", 60.20, 60.55, 0.2, True, [59.8, 60.0, 59.9, 60.1, 60.2, 60.3, 60.4, 60.55], 3),
            ("🇸🇦", "SAR", 13.00, 13.05, 0.1, True, [12.9, 12.95, 13.0, 12.98, 13.0, 13.02, 13.03, 13.05], 4),
        ]
        for flag, code, buy, sell, change, up, series, order in currencies:
            Currency.objects.update_or_create(
                code=code, defaults=dict(flag_emoji=flag, buy=buy, sell=sell, change_pct=change, is_up=up, series=series, order=order)
            )

        gold = [
            ("عيار 24", 4220, 0.9, True, 1), ("عيار 21", 3550, 0.8, True, 2),
            ("عيار 18", 3050, 0.7, True, 3), ("جنيه ذهب", 33760, -0.2, False, 4),
        ]
        for label, price, change, up, order in gold:
            GoldKarat.objects.update_or_create(label=label, defaults=dict(price=price, change_pct=change, is_up=up, order=order))

        cities = [
            ("cairo", "القاهرة", "☀️", 34, 36, 24, 32, 1), ("alex", "الإسكندرية", "⛅", 29, 31, 23, 58, 2),
            ("luxor", "الأقصر", "☀️", 41, 43, 27, 15, 3), ("aswan", "أسوان", "☀️", 43, 45, 29, 12, 4),
        ]
        for key, label, icon, temp, hi, lo, humidity, order in cities:
            WeatherCity.objects.update_or_create(
                key=key, defaults=dict(label=label, icon=icon, temp=temp, hi=hi, lo=lo, humidity=humidity, order=order)
            )

        modules = [
            ("currencies", "العملات", "البنك المركزي المصري", True, 1),
            ("gold", "الذهب", "جمعية الذهب المصرية", True, 2),
            ("index", "المؤشر الرئيسي", "البورصة المصرية", True, 3),
            ("weather", "الطقس", "الأرصاد الجوية", True, 4),
            ("oil", "أسعار النفط", "مصدر خارجي", False, 5),
        ]
        for key, label, source, active, order in modules:
            TickerModule.objects.update_or_create(key=key, defaults=dict(label=label, source=source, active=active, order=order))

    # ------------------------------------------------------------- site config
    def seed_site_settings(self):
        settings_obj = SiteSettings.load()
        settings_obj.site_name = "الدفتر نيوز"
        settings_obj.tagline = "سِجلّ اليوم.. خبراً خبراً"
        settings_obj.seo_title = "الدفتر نيوز — aldaftarnews.com"
        settings_obj.seo_description = "موقع إخباري عربي يغطي مصر والمنطقة: سياسة، اقتصاد، رياضة، ورأي."
        settings_obj.save()
        socials = [
            ("facebook", "https://facebook.com/aldaftarnews"), ("x", "https://x.com/aldaftarnews"),
            ("instagram", "https://instagram.com/aldaftarnews"), ("youtube", "https://youtube.com/@aldaftarnews"),
        ]
        for platform, url in socials:
            SocialLink.objects.update_or_create(platform=platform, defaults=dict(url=url))

    # ----------------------------------------------------------- daily visits
    def seed_daily_visits(self):
        # Same 7-day series as the DashOverview.dc.html mock chart.
        series = [42, 58, 49, 66, 71, 60, 48]
        today = timezone.localdate()
        prev = None
        for i, visits in enumerate(reversed(series)):
            date = today - datetime.timedelta(days=i)
            change = round(((visits - prev) / prev) * 100, 2) if prev else 4.2
            DailyVisit.objects.update_or_create(date=date, defaults=dict(visits=visits * 1000 + random.randint(0, 999), change_pct=change))
            prev = visits

    # ------------------------------------------------------------- stories
    def seed_stories(self, sections):
        rows = [
            ("محور الدلتا.. الصورة الكاملة", "egypt", "/section/egypt", 1),
            ("قرار الفائدة في دقيقة", "economy", "/section/economy", 2),
            ("جوّه الجون: ملخص الجولة", "sports", "/section/sports", 3),
            ("ستايل ونجوم هذا الأسبوع", "style", "/section/style", 4),
            ("علوم وتكنولوجيا: أهم ما فاتك", "tech", "/section/tech", 5),
            ("ملف خاص: الطاقة الشمسية", "special", "/section/special", 6),
            ("دليلك الأول للمدارس", "guide", "/section/guide", 7),
        ]
        for title, key, href, order in rows:
            Story.objects.update_or_create(
                title=title,
                defaults=dict(section=sections.get(key), href=href, order=order, active=True),
            )

    # ------------------------------------------------------- welcome alert
    def seed_welcome_alert(self):
        from siteconfig.models import WelcomeAlert

        alert = WelcomeAlert.load()
        alert.active = True
        alert.kicker = "يحدث الآن"
        alert.title = "تغطية لحظية: مؤتمر البنك المركزي"
        alert.text = "محافظ البنك المركزي يعلن قرار الفائدة خلال دقائق — تابع التغطية لحظة بلحظة."
        alert.cta_label = "تابع البث المباشر"
        alert.cta_href = "/live"
        alert.save()

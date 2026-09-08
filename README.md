# الدفتر نيوز — aldaftarnews.com

بوابة إخبارية مصرية ثنائية اللغة (عربي RTL افتراضياً + طبعة إنجليزية) مع لوحة تحرير كاملة.

- **الخلفية:** Django 5.2 + Django REST Framework + PostgreSQL — `backend/`
- **الواجهة:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind — `frontend/`
- **الإنتاج:** nginx ← Next على `127.0.0.1:3300` + gunicorn على `127.0.0.1:8300` (انظر `docs/DEPLOY.md`)

## بنية المستودع

```
backend/    Django: 8 تطبيقات (accounts, content, media_library, video, ads, market, siteconfig, integrations)
frontend/   Next.js: app/ (المسارات) · components/site (الموقع) · components/dashboard (اللوحة) · lib/
scripts/    backup.sh · healthcheck.sh · start-dev.sh (تشغيل محلي) · hooks/pre-push
docs/       DEPLOY.md (النشر والتشغيل) · CLEANUP_REPORT.md (مراجعة سبتمبر 2026)
design/     حزمة التصميم الأصلية من Claude Design (chats/ + project/*.dc.html) — مرجع، ليست كوداً
Makefile    make check — كل الفحوصات قبل أي push
```

## التشغيل محلياً

بأمر واحد (يجهّز الـvenv والحزم وقاعدة البيانات والبيانات التجريبية ثم يشغّل الخادمين):

```sh
scripts/start-dev.sh
```

- الموقع: http://localhost:3891 · الـAPI: http://localhost:8891/api/
- مسار لوحة التحكم مكتوب في `frontend/lib/routes.ts` (ليس `/dashboard` عمداً).
- `scripts/start-dev.sh --check` يجهّز ويتأكد أن الصفحات تستجيب ثم يخرج.

يدوياً:

```sh
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # بدون POSTGRES_DB يعمل على sqlite للتجربة السريعة فقط
python manage.py migrate
python manage.py seed_demo_data # محتوى تجريبي (كلمة مرور الحسابات التجريبية: aldaftar-demo)
python manage.py runserver 0.0.0.0:8891

cd frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL
npm run dev -- -p 3891
```

## الفحوصات

```sh
make check        # انحراف الهجرات ← tsc ← eslint ← اختبارات الخلفية ← اختبارات الواجهة ← بناء تحقق
make check-fast   # كل ما سبق عدا البناء
make install-hooks   # مرة واحدة: خطّاف pre-push يشغّل check-fast
```

البناء في `make check` يذهب إلى `.next-verify` ولا يمس `.next` الحيّة إطلاقاً — هذا المستودع هو نسخة الإنتاج نفسها. النشر الفعلي عبر `frontend/scripts/deploy-frontend.sh` فقط (انظر `docs/DEPLOY.md`).

## أهم ما يميّز البنية

- **المتن بلوكات منظّمة لا HTML:** `content.ArticleBlock`، والتنسيق الداخلي بصيغة توكنات (`frontend/lib/richtext.ts`) تمنع XSS.
- **الصلاحيات على محورين:** `is_staff` يفتح اللوحة، و`role` (admin/editor/author/moderator) يحدد ما يُسمح به داخلها — `backend/aldaftar/permissions.py`، والافتراضي «مرفوض».
- **الكاش:** ISR بنوافذ قصيرة + إشارات `post_save` تنادي `/revalidate` في Next بتوكن، فأي مسار نشر (اللوحة، الأدمن، الـcron) يُبطل الكاش فوراً.
- **التغذيات الخارجية:** ست مصادر معزولة (`backend/integrations/providers/`) يديرها `sync_feeds` على cron، وسجل حالة لكل مصدر في اللوحة.
- **«حصل إيه؟» (الريلز):** رابط يوتيوب واحد في اللوحة؛ العنوان والصورة يُجلبان تلقائياً (`backend/video/youtube.py`)، والريل يُشغَّل في نافذة فوق الرئيسية وله صفحته `/reel/<slug>`.
- **الصوت:** «استمع للمقال» عبر edge-tts (`backend/content/tts.py`)، يُولَّد عند النشر وعبر `generate_tts` على cron.
- **الأقسام المخفية:** مفتاح واحد لكل قسم في `frontend/lib/hiddenDesks.ts` يُخفيه من كل الواجهات دون حذف بيانات.

## المتغيرات والأسرار

`backend/.env` و`frontend/.env.local` (انسخ من ملفات `.example`). القائمة الكاملة وتفسيرها في `docs/DEPLOY.md`. لا تُرفع الملفات الحقيقية إلى git.

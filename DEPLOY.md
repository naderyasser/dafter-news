# نشر الدفتر نيوز — dafter.educore.software

هذا الملف مكتوب ليُعطى كما هو لوكيل نشر (أو لمهندس) يعمل على السيرفر مباشرة.

---

انشر مشروع «الدفتر نيوز» على هذا السيرفر — موقع إخباري عربي RTL.

**النطاق:** `dafter.educore.software`

## المصدر

https://github.com/naderyasser/dafter-news

بنية المشروع:

- `backend/` — Django 5.2 + DRF (8 تطبيقات، ~30 endpoint)
- `frontend/` — Next.js 14 App Router + TypeScript + Tailwind (35 route)
- `start.sh` — ⚠️ سكربت **تطوير** فقط (`runserver` + `npm run dev`).
  لا تستخدمه للإنتاج.

## المطلوب: نشر إنتاجي كامل

1. **قاعدة البيانات:** PostgreSQL. المشروع يقع تلقائياً على sqlite إذا كان
   `POSTGRES_DB` غير مضبوط — تأكد أنه مضبوط، وإلا ستنشر بقاعدة ملفية.
2. **الخلفية:** gunicorn خلف systemd. لا تستخدم `manage.py runserver`.
3. **الواجهة:** `npm ci && npm run build && npm start` خلف systemd (أو PM2).
   ليست موقعاً ثابتاً — فيها SSR وISR، فلا تحاول تصديرها بـ`next export`.
4. **nginx:** reverse proxy على `dafter.educore.software`، مع تقديم
   `/media/` و`/static/` من القرص مباشرة.
5. **SSL:** certbot / Let's Encrypt لـ `dafter.educore.software`.
6. **cron:** `sync_feeds` كل دقيقة (تفصيل أسفل).

## متغيرات البيئة

`backend/.env` (انسخ من `backend/.env.example`):

```
DJANGO_SECRET_KEY=<ولّد مفتاحاً جديداً — لا تستخدم الافتراضي>
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=dafter.educore.software
POSTGRES_DB=aldaftar
POSTGRES_USER=aldaftar
POSTGRES_PASSWORD=<كلمة مرور قوية>
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
CORS_ALLOWED_ORIGINS=https://dafter.educore.software
OPENWEATHER_API_KEY=<من openweathermap.org>
NEWSDATA_API_KEY=<من newsdata.io>
THESPORTSDB_KEY=3
WEATHER_PROVIDER=openweathermap
```

`frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=https://dafter.educore.software/api
```

⚠️ لا ترفع أي من الملفين إلى git — كلاهما في `.gitignore` بالفعل، لكن تحقق
قبل أي commit.

## المصادر الخارجية

`python manage.py sync_feeds` يحدّث ستة مصادر: العملات، الذهب، الطقس، مواقيت
الصلاة، المباريات، وأخبار الوكالات. شغّله على cron كل دقيقة:

```
* * * * * cd /srv/dafter-news/backend && .venv/bin/python manage.py sync_feeds >> /var/log/aldaftar-sync.log 2>&1
```

نداء واحد لكل مصدر في كل تشغيل — لا يتأثر بعدد الزوار، لأن الزوار يقرأون من
قاعدة البيانات لا من المزوّد.

**مهم — الترخيص:** أبقِ `WEATHER_PROVIDER=openweathermap`. الخيار الآخر
(`open-meteo`) بلا مفتاح لكن ترخيصه المجاني **غير تجاري**، وهذا موقع تجاري.
لن يتحول إليه تلقائياً — بل سيفشل مصدر الطقس إن نقص المفتاح، وهذا مقصود.

## بعد النشر — تحقق من هذا تحديداً

```sh
cd backend  && .venv/bin/python manage.py test   # يجب أن تمر 199
cd frontend && npm test                          # يجب أن تمر 153
```

ثم:

- `https://dafter.educore.software/` — الرئيسية
- `https://dafter.educore.software/dashboard` — لوحة التحكم
- `https://dafter.educore.software/dashboard/feeds` — حالة المصادر الخارجية.
  عمود **«آخر تحديث ناجح»** هو المهم: مصدر فاشل يُبقي آخر بيانات ناجحة ظاهرة
  على الموقع، فلن ترى العطل في الواجهة إطلاقاً — هذه الصفحة هي المكان الوحيد
  الذي يظهر فيه الفرق.
- شغّل `.venv/bin/python manage.py sync_feeds` يدوياً مرة، وتأكد أن **الطقس
  والأخبار** نجحا فعلاً: المفتاحان لم يُختبرا على API حقيقي بعد.

## أخطاء وقعنا فيها فعلاً — تجنّبها

1. **منفذ مشغول بخادم قديم:** الموقع "يعمل" لكنه يقدّم نسخة قديمة، وكل إعادة
   بناء تبدو بلا أثر. تأكد أن systemd أوقف القديم قبل تشغيل الجديد.
2. **تشغيل الواجهة قبل جاهزية الـAPI:** صفحات Next تُبنى ببيانات فارغة ثم
   تُخزَّن كذلك، فيبدو الأمر كخلل في البيانات لا كخطأ ترتيب. اجعل خدمة الواجهة
   `After=` خدمة الخلفية، وانتظر استجابة `/api/sections/` فعلياً.
3. **كاش ISR:** بعد أي تغيير في البيانات تظل الصفحات المخزّنة قديمة حتى تنتهي
   نافذة `revalidate` (60 ثانية للرئيسية، 900 للهيدر). عند التحقق بعد النشر
   امسح `.next/cache` أو انتظر النافذة، وإلا ستطارد خللاً غير موجود.

## أول تشغيل

```sh
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo_data     # مرة واحدة — محتوى تجريبي
.venv/bin/python manage.py createsuperuser    # للوصول إلى /admin/
```

المحتوى التجريبي يمكن حذفه لاحقاً من لوحة التحكم.

---

اسأل قبل أن تبدأ لو أي شيء غير واضح في إعداد السيرفر: المسارات، مستخدم
النظام، وجود nginx أو PostgreSQL مسبقاً، أو ما إذا كان النطاق موجّهاً بالفعل
إلى هذا السيرفر.

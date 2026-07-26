#!/usr/bin/env bash
#
# تشغيل الدفتر نيوز محلياً بأمر واحد:  ./start.sh
#
# آمن للتكرار: كل خطوة تتخطى نفسها لو خلصت قبل كده، فتقدر تشغّله كل مرة.
# بيجهّز البيئة الافتراضية، الحزم، قاعدة البيانات، البيانات التجريبية،
# ثم يشغّل الخادمين معاً.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# --check: جهّز، تأكد أن الخادمين يستجيبان، ثم اخرج بدل الانتظار.
# للاستخدام في CI أو للتأكد السريع أن البيئة سليمة.
CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

say()  { printf "\n\033[1;36m▸ %s\033[0m\n" "$1"; }
ok()   { printf "  \033[0;32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[0;33m!\033[0m %s\n" "$1"; }
die()  { printf "\n\033[0;31m✗ %s\033[0m\n" "$1" >&2; exit 1; }

# ---------------------------------------------------------------- المتطلبات
say "التحقق من المتطلبات"
command -v python3 >/dev/null || die "python3 غير مثبّت"
command -v node    >/dev/null || die "node غير مثبّت — نسخة 18 أو أحدث"
command -v npm     >/dev/null || die "npm غير مثبّت"

NODE_MAJOR="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node $NODE_MAJOR قديم — المطلوب 18 أو أحدث"
ok "python $(python3 -V | cut -d' ' -f2) · node $(node -v)"

# المنافذ مشغولة؟ ده أكثر سبب يخلي الموقع "مش بيفتح": خادم قديم ماسك المنفذ
# وبيقدّم نسخة قديمة، أو الخادم الجديد بيموت في صمت.
for PORT in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  if command -v lsof >/dev/null && lsof -ti tcp:"$PORT" >/dev/null 2>&1; then
    warn "المنفذ $PORT مشغول — سيتم إنهاء العملية القديمة"
    lsof -ti tcp:"$PORT" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
done

# ------------------------------------------------------------------ الخلفية
say "تجهيز الخلفية (Django)"
cd "$BACKEND"

if [ ! -d .venv ]; then
  python3 -m venv .venv
  ok "أُنشئت البيئة الافتراضية"
fi
# shellcheck disable=SC1091
source .venv/bin/activate

if ! python -c "import django" 2>/dev/null; then
  pip install -q --upgrade pip
  pip install -q -r requirements.txt
  ok "ثُبّتت حزم بايثون"
else
  ok "حزم بايثون جاهزة"
fi

if [ ! -f .env ]; then
  cp .env.example .env
  warn "أُنشئ backend/.env من المثال — أضف مفاتيح الـAPI فيه"
fi

python manage.py migrate --noinput >/dev/null
ok "قاعدة البيانات محدّثة"

# البذر مرة واحدة فقط: إعادته على قاعدة فيها محتوى حقيقي تكتب فوق التعديلات
if [ ! -f .seeded ]; then
  python manage.py seed_demo_data >/dev/null
  touch .seeded
  ok "زُرعت البيانات التجريبية"
else
  ok "البيانات موجودة (احذف backend/.seeded لإعادة الزرع)"
fi

# ------------------------------------------------------------------ الواجهة
say "تجهيز الواجهة (Next.js)"
cd "$FRONTEND"

if [ ! -d node_modules ]; then
  npm install --silent
  ok "ثُبّتت حزم node"
else
  ok "حزم node جاهزة"
fi

if [ ! -f .env.local ]; then
  echo "NEXT_PUBLIC_API_URL=http://localhost:$BACKEND_PORT/api" > .env.local
  ok "أُنشئ frontend/.env.local"
fi

# ---------------------------------------------------------------- التشغيل
say "تشغيل الخادمين"
cd "$BACKEND"
python manage.py runserver "0.0.0.0:$BACKEND_PORT" >"$ROOT/backend.log" 2>&1 &
BACKEND_PID=$!

# ننتظر جاهزية الـAPI فعلياً قبل تشغيل الواجهة: لو بدأت الواجهة أولاً فقد
# تُبنى صفحاتها ببيانات فارغة وتظل مخزّنة كذلك.
for _ in $(seq 1 30); do
  if curl -sf -o /dev/null "http://127.0.0.1:$BACKEND_PORT/api/sections/" 2>/dev/null; then
    ok "الخلفية تعمل على المنفذ $BACKEND_PORT"
    break
  fi
  kill -0 "$BACKEND_PID" 2>/dev/null || die "توقفت الخلفية — راجع backend.log"
  sleep 1
done

cd "$FRONTEND"
npm run dev -- -p "$FRONTEND_PORT" >"$ROOT/frontend.log" 2>&1 &
FRONTEND_PID=$!

for _ in $(seq 1 40); do
  if curl -sf -o /dev/null "http://127.0.0.1:$FRONTEND_PORT/" 2>/dev/null; then
    ok "الواجهة تعمل على المنفذ $FRONTEND_PORT"
    break
  fi
  kill -0 "$FRONTEND_PID" 2>/dev/null || die "توقفت الواجهة — راجع frontend.log"
  sleep 1
done

cleanup() {
  printf "\n\033[1;36m▸ إيقاف الخادمين...\033[0m\n"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [ "$CHECK_ONLY" = "1" ]; then
  say "فحص الصفحات"
  FAILED=0
  for PAGE in / /dashboard /markets /live /article/president-opens-delta-corridor; do
    CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$FRONTEND_PORT$PAGE" || echo 000)"
    if [ "$CODE" = "200" ]; then ok "$PAGE"; else warn "$PAGE → $CODE"; FAILED=1; fi
  done
  [ "$FAILED" = "0" ] || die "بعض الصفحات لم تستجب"
  printf "\n  \033[0;32m✅ البيئة سليمة\033[0m\n\n"
  exit 0
fi

cat <<EOF

  ✅ جاهز

     الموقع        http://localhost:$FRONTEND_PORT
     لوحة التحكم   http://localhost:$FRONTEND_PORT/dashboard
     الـAPI        http://localhost:$BACKEND_PORT/api/
     إدارة Django  http://localhost:$BACKEND_PORT/admin/

     السجلات: backend.log · frontend.log
     للإيقاف: Ctrl+C

EOF

wait

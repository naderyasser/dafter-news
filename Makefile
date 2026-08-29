# الدفتر نيوز — أوامر التحقق.
#
# `make check` هو الأمر الوحيد الذي يجب أن يمر قبل أي push. يشغّل كل شيء:
# فحص الأنواع، الـlint، اختبارات الواجهة والخلفية، ثم بناء الواجهة.
#
# مبني ليعمل على السيرفر مباشرة، لذا:
#  - لا يلمس .next الحيّة إطلاقاً — البناء يذهب إلى .next-verify (انظر
#    هدف build أدناه). النشر الحقيقي يبقى scripts/deploy-frontend.sh.
#  - لا يشغّل أي شيء يكتب في قاعدة بيانات الإنتاج؛ اختبارات Django تنشئ
#    قاعدة اختبار خاصة بها وتحذفها بعدها.

FRONTEND := frontend
BACKEND  := backend
PY       := $(BACKEND)/.venv/bin/python

.PHONY: check check-fast typecheck lint test-backend test-frontend build coverage migrations-check install-hooks help

help:
	@echo "make check        — كل الفحوصات (شغّله قبل الـpush)"
	@echo "make check-fast   — كل شيء عدا البناء"
	@echo "make typecheck    — tsc --noEmit"
	@echo "make lint         — eslint"
	@echo "make test-backend — اختبارات Django"
	@echo "make test-frontend— اختبارات vitest"
	@echo "make coverage     — التغطية للطرفين"
	@echo "make build        — بناء تحقق إلى .next-verify (لا يمس الموقع الحيّ)"
	@echo "make install-hooks— تركيب خطّاف pre-push (مرة واحدة لكل نسخة)"

# .git/hooks لا يُتتبَّع في git، فالنسخة المتتبَّعة في scripts/hooks/ وهذا
# الهدف ينسخها. شغّله مرة واحدة بعد الاستنساخ.
install-hooks:
	@cp scripts/hooks/pre-push .git/hooks/pre-push
	@chmod +x .git/hooks/pre-push
	@echo "✓ تم تركيب pre-push"

check: check-fast build
	@echo ""
	@echo "✓ كل الفحوصات مرّت — آمن للـpush"

check-fast: migrations-check typecheck lint test-backend test-frontend

# انحراف النماذج عن الهجرات: يفشل إن كان هناك تعديل على model بلا migration.
migrations-check:
	@echo "── فحص انحراف الهجرات"
	@cd $(BACKEND) && ../$(PY) manage.py makemigrations --check --dry-run

typecheck:
	@echo "── فحص الأنواع"
	@cd $(FRONTEND) && npx tsc --noEmit -p tsconfig.json

lint:
	@echo "── eslint"
	@cd $(FRONTEND) && npx eslint .

test-backend:
	@echo "── اختبارات الخلفية"
	@cd $(BACKEND) && ../$(PY) manage.py test

test-frontend:
	@echo "── اختبارات الواجهة"
	@cd $(FRONTEND) && npx vitest run

coverage:
	@cd $(BACKEND) && ../$(PY) -m coverage run --source=. \
		--omit="*/migrations/*,*/.venv/*,manage.py,*/tests*.py,aldaftar/wsgi.py,aldaftar/asgi.py" \
		manage.py test && ../$(PY) -m coverage report
	@cd $(FRONTEND) && npx vitest run --coverage

# بناء تحقق فقط: distDir منفصل حتى لا يُستبدل البندل الذي يخدم القرّاء الآن.
build:
	@echo "── بناء تحقق (.next-verify)"
	@cd $(FRONTEND) && NEXT_DIST_DIR=.next-verify npx next build

# Alnuqta Media

الموقع الإخباري وغرفة أخبار النقطة. Supabase هو مصدر البيانات والصلاحيات الفعلي
للمواد المنشورة، الفريق، صندوق المصادر، والنشرة البريدية.

## المكونات

- `index.html` و`newsroom.html`: واجهة الموقع العامة.
- `admin/index.html` و`admin/dashboard.html`: تسجيل الدخول ولوحة غرفة الأخبار.
- `supabase/functions`: دوال Edge الخاصة بالموقع والاستوديو.
- `supabase/migrations`: تغييرات قاعدة البيانات القابلة للتتبع.
- `content/posts`: محتوى Git قديم؛ ليس المصدر التشغيلي الأساسي.
- `tina/` وملفات Decap: أدوات قديمة معزولة عن لوحة Supabase.

## إعداد Supabase المحلي

أنشئ `public/supabase-public-config.js` محلياً ولا ترفعه إلى Git. يجب أن يحتوي
فقط على عنوان المشروع ومفتاح anon العام. لا تضع `service_role` أو مفاتيح Gemini
أو Pexels في ملفات المتصفح. المفاتيح السرية تحفظ في Supabase Edge Function Secrets.

## الفحص

```bash
npm test
```

يشغّل فحص صياغة السكربتات ثم `scripts/validate-site.mjs` للتأكد من الملفات
الأساسية، التكاملات، ومنع الادعاءات الأمنية غير المثبتة.

## النشر

GitHub Actions ينشر الموقع إلى GitHub Pages من فرع `main`. راجع
`.github/workflows/pages-deploy.yml` لمعرفة خطوات النشر.

## ملاحظات أمنية

- نشر المقالات محصور بدور `owner` عبر قاعدة البيانات، وليس الواجهة فقط.
- صندوق المصادر ليس بديلاً عن SecureDrop ولا يستقبل معلومات شديدة الحساسية.
- `admin/portal.html` نموذج تصميم قديم؛ اللوحة الفعلية هي `admin/dashboard.html`.

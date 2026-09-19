(() => {
  const config = window.ALNUQTA_SUPABASE_PUBLIC || {};
  const endpoint = config.url ? `${config.url}/functions/v1/newsletter-subscribe` : "";
  const messages = {
    invalid_subscription: "أدخل بريداً إلكترونياً صحيحاً ووافق على سياسة الاشتراك.",
    rate_limited: "محاولات كثيرة مؤقتاً. حاول بعد ساعة.",
    subscription_failed: "تعذر تسجيل الاشتراك الآن. حاول لاحقاً.",
  };

  document.querySelectorAll(".newsletter-form").forEach((form) => {
    const status = form.querySelector("[data-newsletter-status]");
    const button = form.querySelector("button[type=submit]");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!endpoint) { status.textContent = "خدمة الاشتراك غير مفعّلة حالياً."; return; }
      button.disabled = true;
      status.textContent = "جاري تسجيل طلب الاشتراك…";
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(config.anonKey ? { apikey: config.anonKey } : {}) },
          body: JSON.stringify({
            email: form.elements.email.value,
            consent: form.elements.consent.checked,
            website: form.elements.website.value,
            source: form.dataset.source || "website",
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(messages[result.error] || messages.subscription_failed);
        form.reset();
        status.textContent = result.already_active
          ? "هذا البريد مشترك ومؤكد بالفعل."
          : result.confirmation_sent
            ? "أرسلنا رابط التأكيد إلى بريدك."
            : "تم تسجيل طلبك. سنرسل رابط التأكيد بعد تفعيل خدمة البريد الرسمية.";
      } catch (error) {
        status.textContent = error.message || messages.subscription_failed;
      } finally {
        button.disabled = false;
      }
    });
  });
})();

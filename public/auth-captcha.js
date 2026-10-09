(function () {
  const key = String(window.ALNUQTA_AUTH_SECURITY?.turnstileSiteKey || '').trim();
  let token = '', widget = null, busy = false;
  const box = document.getElementById('authCaptcha');
  const status = document.getElementById('status');
  const message = text => { if (status) status.textContent = text; };
  function reset() {
    token = '';
    if (widget !== null && window.turnstile) window.turnstile.reset(widget);
  }
  window.ALNUQTA_AUTH_CAPTCHA = {
    async run(action) {
      if (busy) throw new Error('انتظر انتهاء الطلب الحالي.');
      if (key && !token) throw new Error('أكمل التحقق الأمني أولاً. إذا لم يظهر، أعد تحميل الصفحة.');
      const options = key ? { captchaToken: token } : {};
      busy = true;
      if (key) token = '';
      try { return await action(options); } finally { if (key) reset(); busy = false; }
    }
  };
  if (!key) return;
  if (!box) { message('تعذر تحميل التحقق الأمني.'); return; }
  box.hidden = false;
  window.alnuqtaTurnstileReady = () => {
    widget = window.turnstile.render(box, {
      sitekey: key, theme: 'dark', language: 'ar', size: 'flexible',
      callback: value => { token = value; message('اكتمل التحقق الأمني.'); },
      'expired-callback': () => { token = ''; message('انتهت صلاحية التحقق؛ أعد التحقق قبل المتابعة.'); },
      'error-callback': () => { token = ''; message('تعذر التحقق الأمني. أعد تحميل الصفحة أو حاول لاحقاً.'); }
    });
  };
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=alnuqtaTurnstileReady&render=explicit';
  script.async = true;
  script.onerror = () => message('تعذر تحميل التحقق الأمني. أعد تحميل الصفحة أو حاول لاحقاً.');
  document.head.appendChild(script);
})();

(() => {
  const labels = {
    home: 'الرئيسية',
    newsroom: 'غرفة الأخبار',
    investigations: 'التحقيقات الاستقصائية',
    documents: 'أرشيف الوثائق',
    about: 'عن المنصة',
    whistleblower: 'إرسال معلومة'
  };

  const go = (target) => {
    if (target === 'newsroom') {
      window.location.href = 'newsroom.html';
      return;
    }
    if (typeof window.navTo === 'function') window.navTo(target);
  };

  const addDesktopNewsroom = () => {
    const nav = document.querySelector('header nav');
    if (!nav || nav.querySelector('[data-homepage-newsroom]')) return;
    const before = document.getElementById('nav-investigations');
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'nav-newsroom';
    button.dataset.homepageNewsroom = 'true';
    button.className = 'nav-item hover:text-brandRed transition';
    button.textContent = labels.newsroom;
    button.addEventListener('click', () => go('newsroom'));
    nav.insertBefore(button, before || nav.firstChild);
  };

  const addMobileNewsroom = () => {
    const menu = document.getElementById('mobile-menu');
    if (!menu || menu.querySelector('[data-homepage-newsroom]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.homepageNewsroom = 'true';
    button.className = 'block w-full text-right py-2 hover:text-brandRed';
    button.textContent = labels.newsroom;
    button.addEventListener('click', () => go('newsroom'));
    const investigations = [...menu.querySelectorAll('button')].find((el) => el.textContent.includes(labels.investigations));
    menu.insertBefore(button, investigations || menu.firstChild);
  };

  const repairNavigation = () => {
    addDesktopNewsroom();
    addMobileNewsroom();
    document.querySelectorAll('button.nav-item').forEach((button) => {
      const text = button.textContent.trim();
      const match = Object.entries(labels).find(([, label]) => text.includes(label));
      if (!match) return;
      button.type = 'button';
      button.addEventListener('click', () => go(match[0]), { once: true });
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', repairNavigation);
  else repairNavigation();
})();

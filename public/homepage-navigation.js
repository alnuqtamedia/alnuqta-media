(() => {
  // Real page navigation for the public Alnuqta Media site.
  const routes = {
    home: 'index.html',
    newsroom: 'newsroom.html',
    investigations: 'investigations.html',
    documents: 'documents.html',
    whistleblower: 'submit.html',
    about: 'about.html'
  };
  const labels = {
    newsroom: 'غرفة الأخبار',
    investigations: 'التحقيقات الاستقصائية',
    documents: 'أرشيف الوثائق',
    whistleblower: 'إرسال معلومة',
    about: 'عن المنصة'
  };

  window.navTo = (target) => {
    const route = routes[target] || routes.home;
    window.location.href = route;
  };

  const addLink = (container, target, before) => {
    if (!container || container.querySelector(`[data-homepage-route="${target}"]`)) return;
    const link = document.createElement('a');
    link.href = routes[target];
    link.dataset.homepageRoute = target;
    link.className = 'nav-item hover:text-brandRed transition font-cairo font-bold text-sm';
    link.textContent = labels[target];
    if (before) container.insertBefore(link, before);
    else container.appendChild(link);
  };

  const repairNavigation = () => {
    const nav = document.querySelector('header nav');
    const before = document.getElementById('nav-investigations');
    addLink(nav, 'newsroom', before);

    const mobile = document.getElementById('mobile-menu');
    if (mobile) {
      const firstInvestigations = [...mobile.querySelectorAll('button')].find((el) => el.textContent.includes(labels.investigations));
      if (!mobile.querySelector('[data-homepage-route="newsroom"]')) {
        const link = document.createElement('a');
        link.href = routes.newsroom;
        link.dataset.homepageRoute = 'newsroom';
        link.className = 'block w-full text-right py-2 hover:text-brandRed';
        link.textContent = labels.newsroom;
        mobile.insertBefore(link, firstInvestigations || mobile.firstChild);
      }
    }

    document.querySelectorAll('[onclick*="navTo("]').forEach((el) => {
      const match = el.getAttribute('onclick').match(/navTo\(['"]([^'"]+)['"]\)/);
      if (!match || !routes[match[1]]) return;
      el.removeAttribute('onclick');
      el.addEventListener('click', () => window.location.href = routes[match[1]]);
      if (el.tagName === 'BUTTON') el.type = 'button';
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', repairNavigation);
  else repairNavigation();
})();

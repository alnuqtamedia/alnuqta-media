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

  window.navTo = (target) => {
    const route = routes[target] || routes.home;
    window.location.href = route;
  };

  const repairNavigation = () => {
    // The newsroom links are already part of index.html. Do not inject duplicates.
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

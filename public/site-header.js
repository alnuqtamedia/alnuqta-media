(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.site-header');
    if (!header) return;
    if(document.documentElement.lang === 'en') {
      const labels={'الرئيسية':'Home','مقالات الرأي':'Opinion Articles','تقارير':'Reports','التحقيقات':'Investigations','الوثائق':'Documents','الأرشيف':'Archive','عن المنصة':'About us','إرسال معلومة':'Submit a tip'};
      header.querySelectorAll('a').forEach(link=>{if(labels[link.textContent.trim()])link.textContent=labels[link.textContent.trim()];});
      header.querySelector('.site-brand').innerHTML='Alnuqta <span>Media</span>';
      header.querySelector('nav').setAttribute('aria-label','Main navigation');
      header.querySelector('.site-mobile-toggle').setAttribute('aria-label','Open navigation menu');
      header.querySelector('[data-sections-toggle]').setAttribute('aria-label','Show sections');
    }
    const mobile = header.querySelector('.site-mobile-toggle');
    const toggle = header.querySelector('[data-sections-toggle]');
    const home = header.querySelector('.home-menu');
    const navigation = header.querySelector('.site-navigation');
    const desktop = matchMedia('(min-width:1100px)');
    const setHome = open => { home.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); };
    const close = () => { setHome(false); header.classList.remove('mobile-open'); mobile.setAttribute('aria-expanded','false'); };
    toggle.addEventListener('click', () => setHome(toggle.getAttribute('aria-expanded') !== 'true'));
    mobile.addEventListener('click', () => { const open = header.classList.toggle('mobile-open'); mobile.setAttribute('aria-expanded',String(open)); if(!open)setHome(false); });
    desktop.addEventListener('change', close);
    home.addEventListener('pointerenter', event => { if(event.pointerType === 'mouse' && desktop.matches) setHome(true); });
    home.addEventListener('pointerleave', event => { if(event.pointerType === 'mouse' && desktop.matches && !home.contains(document.activeElement)) setHome(false); });
    home.addEventListener('focusout', event => { if(!home.contains(event.relatedTarget)) setHome(false); });
    document.addEventListener('click', event => { if(!header.contains(event.target)) close(); });
    document.addEventListener('keydown', event => { if(event.key === 'Escape'){ const mobileFocused=header.classList.contains('mobile-open')&&navigation.contains(document.activeElement);const homeFocused=home.contains(document.activeElement);close();if(mobileFocused)mobile.focus();else if(homeFocused)toggle.focus(); } });
    window.buildSectionsMenu();
  });
})();

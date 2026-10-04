(() => {
  'use strict';
  const sections = [{"id": "politics", "label": "السياسة", "labelEn": "Politics", "order": 1}, {"id": "world", "label": "أخبار العالم", "labelEn": "World News", "order": 2}, {"id": "economy", "label": "اقتصاد", "labelEn": "Economy", "order": 3}, {"id": "iraq", "label": "أخبار العراق", "labelEn": "Iraq News", "order": 4}, {"id": "sports", "label": "الرياضة", "labelEn": "Sports", "order": 5}, {"id": "arts", "label": "الفن", "labelEn": "Arts", "order": 6}, {"id": "misc", "label": "المنوعات", "labelEn": "Miscellaneous", "order": 7}];
  window.ALNUQTA_SECTIONS = Object.freeze(sections.map(Object.freeze));
  const aliases = {
    'economy-public-money':'economy', 'culture-arts':'arts',
    'field-social':'misc', 'travel-tourism':'misc', 'human-stories':'misc',
    'سياسة':'politics', 'السياسة':'politics', 'سياسي':'politics',
    'أخبار العالم':'world', 'العالم':'world', 'عالمي':'world',
    'اقتصاد':'economy', 'الاقتصاد':'economy', 'اقتصادي':'economy', 'الاقتصاد والمال العام':'economy', 'اقتصاد ومال عام':'economy',
    'أخبار العراق':'iraq', 'العراق':'iraq', 'عراقي':'iraq',
    'الرياضة':'sports', 'رياضة':'sports', 'رياضي':'sports',
    'الفن':'arts', 'فنون':'arts', 'ثقافة وفنون':'arts', 'ثقافة':'arts', 'فني':'arts',
    'المنوعات':'misc', 'منوعات':'misc', 'ميداني واجتماعي':'misc', 'مجتمع':'misc', 'سياحة وسفر':'misc', 'سفر وسياحة':'misc', 'سياحة':'misc', 'قصص إنسانية':'misc'
  };
  window.normalizeCategory = value => {
    const key = String(value ?? '').trim().toLowerCase();
    return sections.some(section => section.id === key) ? key : aliases[key] || 'misc';
  };
  window.buildSectionsMenu = () => {
    const en = document.documentElement.lang === 'en';
    document.querySelectorAll('[data-sections-menu]').forEach(menu => {
      menu.replaceChildren(...sections.map(section => {
        const link = document.createElement('a');
        link.href = `newsroom.html?section=${section.id}`;
        link.textContent = en ? section.labelEn : section.label;
        return link;
      }));
    });
  };
  document.addEventListener('DOMContentLoaded', window.buildSectionsMenu);
})();

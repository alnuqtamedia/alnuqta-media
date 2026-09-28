alter table public.articles
  drop constraint if exists articles_category_check;

alter table public.articles
  add constraint articles_category_check
  check (
    category is null
    or category = any (array[
      'politics'::text,
      'economy-public-money'::text,
      'field-social'::text,
      'culture-arts'::text,
      'travel-tourism'::text,
      'sports'::text,
      'human-stories'::text
    ])
  );

comment on column public.articles.category is
  'Editorial desk/category: politics, economy-public-money, field-social, culture-arts, travel-tourism, sports, or human-stories.';

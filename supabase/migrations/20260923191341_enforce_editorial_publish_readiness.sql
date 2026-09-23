create or replace function public.enforce_article_publish_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Existing published rows remain editable; the complete checklist is enforced
  -- when a material enters the public state for the first time.
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if nullif(btrim(coalesce(new.title, '')), '') is null then
      raise exception 'Published article requires a title';
    end if;
    if nullif(btrim(coalesce(new.body, '')), '') is null
       and coalesce(jsonb_array_length(new.videos), 0) = 0 then
      raise exception 'Published article requires body text or video';
    end if;
    if new.category is null then
      raise exception 'Published article requires an editorial category';
    end if;
    if new.section in ('investigation', 'report', 'analysis')
       and coalesce(jsonb_array_length(new.sources), 0) = 0 then
      raise exception 'Investigations, reports and analysis require at least one source';
    end if;
    if coalesce(nullif(btrim(new.cover_image_url), ''), nullif(btrim(new.image), '')) is not null
       and nullif(btrim(coalesce(new.cover_image_credit, '')), '') is null then
      raise exception 'Published article image requires a credit';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_article_publish_integrity()
  from public, anon, authenticated;
grant execute on function public.enforce_article_publish_integrity()
  to service_role;

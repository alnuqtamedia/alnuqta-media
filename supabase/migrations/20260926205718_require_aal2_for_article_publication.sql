-- Require a fresh MFA-backed session for every change that can affect public
-- content. Existing RLS remains responsible for deciding which newsroom role
-- may edit or publish an article; this trigger adds the independent AAL2 gate.
create or replace function public.enforce_article_publish_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'published'
     or (tg_op = 'UPDATE' and old.status = 'published') then
    if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
      raise exception using
        errcode = '42501',
        message = 'MFA verification is required to publish or modify public content';
    end if;
  end if;

  -- The publication checklist is enforced when material first becomes public.
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

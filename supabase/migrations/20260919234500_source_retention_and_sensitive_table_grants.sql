alter table public.source_submissions
  add column if not exists retention_until timestamptz,
  add column if not exists legal_hold boolean not null default false,
  add column if not exists retention_note text;

update public.source_submissions
set retention_until = created_at + interval '180 days'
where retention_until is null;

alter table public.source_submissions
  alter column retention_until set default (now() + interval '180 days'),
  alter column retention_until set not null;

-- Browser roles must never be able to insert, delete or truncate this table.
-- Public submissions are inserted by the source-submit Edge Function using
-- service_role; newsroom members only read and change review state.
revoke all on table public.source_submissions from anon, authenticated;
grant select on table public.source_submissions to authenticated;
grant update (status, reviewed_by, reviewed_at) on table public.source_submissions to authenticated;

-- Audit rows are written by a SECURITY DEFINER trigger. Browser users only read
-- them, and the existing RLS policy limits that read to owners.
revoke all on table public.audit_logs from anon, authenticated;
grant select on table public.audit_logs to authenticated;

create or replace function public.owner_update_source_retention(
  p_submission_id uuid,
  p_retention_until timestamptz,
  p_legal_hold boolean,
  p_retention_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'owner' then
    raise exception 'Owner only';
  end if;

  if p_retention_until < now() and not p_legal_hold then
    raise exception 'Retention date cannot be in the past';
  end if;

  update public.source_submissions
  set retention_until = p_retention_until,
      legal_hold = p_legal_hold,
      retention_note = nullif(btrim(p_retention_note), '')
  where id = p_submission_id;

  if not found then raise exception 'Submission not found'; end if;
end;
$$;

revoke all on function public.owner_update_source_retention(uuid, timestamptz, boolean, text)
  from public, anon;
grant execute on function public.owner_update_source_retention(uuid, timestamptz, boolean, text)
  to authenticated;

create index if not exists source_submissions_retention_idx
  on public.source_submissions (retention_until)
  where legal_hold = false;

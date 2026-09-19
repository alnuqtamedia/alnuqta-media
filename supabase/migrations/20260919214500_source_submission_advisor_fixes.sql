create policy "deny direct rate limit access"
on public.source_submission_rate_limits for all
to anon, authenticated
using (false)
with check (false);

create index if not exists source_submissions_reviewed_by_idx
on public.source_submissions (reviewed_by);

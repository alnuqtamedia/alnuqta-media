-- New functions owned by postgres must not become browser-callable implicitly.
-- Public RPCs should receive explicit, narrow grants in their own migrations.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

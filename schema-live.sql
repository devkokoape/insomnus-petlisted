-- Run this in Supabase → SQL Editor so the live site can write users, applications, and task claims.

drop policy if exists users_write_ins on public.users;
create policy users_write_ins on public.users
  for insert to anon, authenticated
  with check (true);

drop policy if exists users_write_upd on public.users;
create policy users_write_upd on public.users
  for update to anon, authenticated
  using (true)
  with check (true);

drop policy if exists applications_write_ins on public.applications;
create policy applications_write_ins on public.applications
  for insert to anon, authenticated
  with check (true);

drop policy if exists task_claims_write_ins on public.task_claims;
create policy task_claims_write_ins on public.task_claims
  for insert to anon, authenticated
  with check (true);

drop policy if exists task_claims_write_upd on public.task_claims;
create policy task_claims_write_upd on public.task_claims
  for update to anon, authenticated
  using (true)
  with check (true);

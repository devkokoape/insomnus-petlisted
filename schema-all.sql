-- Paste once in the new project's SQL Editor, then Run.
-- Tables, indexes, RLS, and write policies for the petlist site.

create table if not exists public.users (
  xid text primary key,
  handle text not null unique,
  name text,
  pfp text,
  email text,
  created_at timestamptz not null default now(),
  last_login timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  xid text not null references public.users (xid) on update cascade,
  handle text not null,
  address text not null unique,
  post text not null,
  ref text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists applications_handle_idx on public.applications (handle);
create index if not exists applications_ref_idx on public.applications (ref);
create unique index if not exists applications_xid_uidx on public.applications (xid);

create table if not exists public.task_claims (
  xid text not null references public.users (xid) on update cascade,
  task_id text not null,
  handle text not null default '',
  created_at timestamptz not null default now(),
  primary key (xid, task_id)
);

create index if not exists task_claims_handle_idx on public.task_claims (handle);

create table if not exists public.whitelist (
  address text primary key,
  phase text not null,
  updated_at timestamptz not null default now()
);

create index if not exists whitelist_phase_idx on public.whitelist (phase);

alter table public.users enable row level security;
alter table public.applications enable row level security;
alter table public.task_claims enable row level security;
alter table public.whitelist enable row level security;

drop policy if exists users_public_read on public.users;
create policy users_public_read on public.users
  for select to anon, authenticated
  using (true);

drop policy if exists applications_public_read on public.applications;
create policy applications_public_read on public.applications
  for select to anon, authenticated
  using (true);

drop policy if exists task_claims_public_read on public.task_claims;
create policy task_claims_public_read on public.task_claims
  for select to anon, authenticated
  using (true);

drop policy if exists whitelist_public_read on public.whitelist;
create policy whitelist_public_read on public.whitelist
  for select to anon, authenticated
  using (true);

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

drop policy if exists applications_write_upd on public.applications;
create policy applications_write_upd on public.applications
  for update to anon, authenticated
  using (true)
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

revoke select (email) on public.users from anon, authenticated;

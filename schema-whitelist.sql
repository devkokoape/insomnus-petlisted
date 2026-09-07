-- Run in Supabase → SQL Editor. Read-only for the live checker. Import is local-only.

create table if not exists public.whitelist (
  address text primary key,
  phase text not null,
  updated_at timestamptz not null default now()
);

create index if not exists whitelist_phase_idx on public.whitelist (phase);

alter table public.whitelist enable row level security;

drop policy if exists whitelist_public_read on public.whitelist;
create policy whitelist_public_read on public.whitelist
  for select to anon, authenticated
  using (true);

-- No insert/update/delete for anon. Import uses the secret key (bypasses RLS).

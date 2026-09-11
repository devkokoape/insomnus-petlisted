-- Collect Google emails on users. Hide them from the public API.

alter table public.users add column if not exists email text;

revoke select (email) on public.users from anon, authenticated;

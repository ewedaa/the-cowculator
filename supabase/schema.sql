create table if not exists public.cowculator_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by text
);

alter table public.cowculator_state enable row level security;

drop policy if exists "Allow public read cowculator_state" on public.cowculator_state;
create policy "Allow public read cowculator_state"
on public.cowculator_state
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public write cowculator_state" on public.cowculator_state;
create policy "Allow public write cowculator_state"
on public.cowculator_state
for insert
to anon, authenticated
with check (true);

drop policy if exists "Allow public update cowculator_state" on public.cowculator_state;
create policy "Allow public update cowculator_state"
on public.cowculator_state
for update
to anon, authenticated
using (true)
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cowculator_state'
  ) then
    alter publication supabase_realtime add table public.cowculator_state;
  end if;
end
$$;

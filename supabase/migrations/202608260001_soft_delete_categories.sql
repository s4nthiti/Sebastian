alter table public.categories
add column if not exists deleted_at timestamptz;

create index if not exists categories_household_active_idx
on public.categories(household_id, name)
where deleted_at is null;

alter table public.categories
add column if not exists sort_order integer;

with ranked_categories as (
  select
    id,
    (row_number() over (partition by household_id order by name, id) - 1)::integer as position
  from public.categories
)
update public.categories category
set sort_order = ranked.position
from ranked_categories ranked
where category.id = ranked.id
  and category.sort_order is null;

alter table public.categories
alter column sort_order set default 0,
alter column sort_order set not null,
add constraint categories_sort_order_nonnegative check (sort_order >= 0);

create index if not exists categories_household_sort_idx
on public.categories(household_id, sort_order, name)
where deleted_at is null;

create or replace function public.reorder_categories(ordered_category_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household uuid;
  active_category_count integer;
  ordered_category_count integer;
begin
  ordered_category_count := coalesce(cardinality(ordered_category_ids), 0);
  if ordered_category_count = 0 then
    raise exception 'At least one category is required';
  end if;

  select category.household_id into target_household
  from public.categories category
  where category.id = ordered_category_ids[1]
    and category.deleted_at is null;

  if target_household is null
    or not public.has_household_role(target_household, array['owner','admin','member']::public.household_role[]) then
    raise exception 'Household categories not found';
  end if;

  select count(*) into active_category_count
  from public.categories category
  where category.household_id = target_household
    and category.deleted_at is null;

  if active_category_count <> ordered_category_count
    or (select count(distinct ordered_id.category_id) from unnest(ordered_category_ids) as ordered_id(category_id)) <> ordered_category_count
    or exists (
      select 1
      from unnest(ordered_category_ids) as ordered_id(category_id)
      left join public.categories category
        on category.id = ordered_id.category_id
        and category.household_id = target_household
        and category.deleted_at is null
      where category.id is null
    ) then
    raise exception 'Category list changed; reload and try again';
  end if;

  update public.categories category
  set sort_order = (ordered.position - 1)::integer
  from unnest(ordered_category_ids) with ordinality as ordered(category_id, position)
  where category.id = ordered.category_id
    and category.household_id = target_household;
end;
$$;

revoke all on function public.reorder_categories(uuid[]) from public;
grant execute on function public.reorder_categories(uuid[]) to authenticated;

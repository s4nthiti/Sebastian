alter table public.categories
add column if not exists is_system boolean not null default false;

alter table public.transactions
add column if not exists savings_goal_id uuid references public.savings_goals(id) on delete set null;

create index if not exists transactions_savings_goal_idx
on public.transactions(savings_goal_id, occurred_on desc)
where savings_goal_id is not null;

insert into public.categories(household_id, name, name_th, color, icon, money_type, is_system, deleted_at)
select id, 'Savings', 'เงินออม', '#3a7d6f', 'piggy-bank', 'expense', true, null
from public.households
on conflict (household_id, name) do update
set
  name_th = excluded.name_th,
  color = excluded.color,
  icon = excluded.icon,
  money_type = excluded.money_type,
  is_system = true,
  deleted_at = null;

create or replace function public.add_savings_category_to_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories(household_id, name, name_th, color, icon, money_type, is_system)
  values (new.id, 'Savings', 'เงินออม', '#3a7d6f', 'piggy-bank', 'expense', true)
  on conflict (household_id, name) do update
  set is_system = true, deleted_at = null;
  return new;
end;
$$;

drop trigger if exists add_savings_category_after_household_insert on public.households;
create trigger add_savings_category_after_household_insert
after insert on public.households
for each row execute function public.add_savings_category_to_household();

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.savings_goals'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%current_amount%target_amount%'
  loop
    execute format('alter table public.savings_goals drop constraint %I', constraint_row.conname);
  end loop;
end;
$$;

insert into public.transactions(
  household_id,
  type,
  amount,
  title,
  category_id,
  savings_goal_id,
  occurred_on,
  created_by
)
select
  goal.household_id,
  'expense',
  goal.current_amount,
  'Opening savings balance: ' || goal.name,
  category.id,
  goal.id,
  goal.created_at::date,
  goal.created_by
from public.savings_goals goal
join public.categories category
  on category.household_id = goal.household_id
  and category.name = 'Savings'
where goal.current_amount > 0
  and not exists (
    select 1
    from public.transactions transaction_row
    where transaction_row.savings_goal_id = goal.id
  );

create or replace function public.validate_savings_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.savings_goal_id is null then
    return new;
  end if;

  if new.type <> 'expense' then
    raise exception 'Savings deposits must use the expense storage type';
  end if;

  if not exists (
    select 1
    from public.savings_goals goal
    where goal.id = new.savings_goal_id
      and goal.household_id = new.household_id
  ) then
    raise exception 'Savings asset must belong to the same household';
  end if;

  if not exists (
    select 1
    from public.categories category
    where category.id = new.category_id
      and category.household_id = new.household_id
      and category.name = 'Savings'
      and category.is_system
  ) then
    raise exception 'Savings transactions must use the Savings category';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_savings_transaction_before_change on public.transactions;
create trigger validate_savings_transaction_before_change
before insert or update on public.transactions
for each row execute function public.validate_savings_transaction();

create or replace function public.sync_savings_goal_balance(target_goal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_goal is null then
    return;
  end if;

  update public.savings_goals goal
  set current_amount = greatest(coalesce((
    select sum(case when transaction_row.type = 'expense' then transaction_row.amount else -transaction_row.amount end)
    from public.transactions transaction_row
    where transaction_row.savings_goal_id = target_goal
  ), 0), 0)
  where goal.id = target_goal;
end;
$$;

revoke all on function public.sync_savings_goal_balance(uuid) from public;

create or replace function public.sync_savings_goal_from_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_savings_goal_balance(old.savings_goal_id);
    return old;
  end if;

  if tg_op = 'INSERT' then
    perform public.sync_savings_goal_balance(new.savings_goal_id);
    return new;
  end if;

  if new.savings_goal_id is distinct from old.savings_goal_id then
    perform public.sync_savings_goal_balance(old.savings_goal_id);
  end if;
  perform public.sync_savings_goal_balance(new.savings_goal_id);
  return new;
end;
$$;

drop trigger if exists sync_savings_goal_after_transaction_change on public.transactions;
create trigger sync_savings_goal_after_transaction_change
after insert or update or delete on public.transactions
for each row execute function public.sync_savings_goal_from_transaction();

create or replace function public.contribute_to_savings(
  target_goal uuid,
  requested_amount numeric
)
returns public.savings_goals
language plpgsql
security definer
set search_path = ''
as $$
declare
  goal public.savings_goals%rowtype;
  savings_category uuid;
begin
  select * into goal
  from public.savings_goals
  where id = target_goal
  for update;

  if goal.id is null or not public.has_household_role(goal.household_id, array['owner','admin','member']::public.household_role[]) then
    raise exception 'Savings asset not found';
  end if;

  if requested_amount <= 0 then
    raise exception 'Savings amount must be greater than zero';
  end if;

  select id into savings_category
  from public.categories
  where household_id = goal.household_id
    and name = 'Savings'
    and is_system;

  insert into public.transactions(
    household_id,
    type,
    amount,
    title,
    category_id,
    savings_goal_id,
    occurred_on,
    created_by
  ) values (
    goal.household_id,
    'expense',
    requested_amount,
    'Savings: ' || goal.name,
    savings_category,
    goal.id,
    current_date,
    auth.uid()
  );

  select * into goal
  from public.savings_goals
  where id = target_goal;

  return goal;
end;
$$;

revoke all on function public.contribute_to_savings(uuid, numeric) from public;
grant execute on function public.contribute_to_savings(uuid, numeric) to authenticated;

create or replace function public.protect_system_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_system then
    if tg_op = 'DELETE' then
      raise exception 'System categories cannot be removed or renamed';
    end if;
    if new.deleted_at is not null or new.name is distinct from old.name or not new.is_system then
      raise exception 'System categories cannot be removed or renamed';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_system_category_before_change on public.categories;
create trigger protect_system_category_before_change
before update or delete on public.categories
for each row execute function public.protect_system_category();

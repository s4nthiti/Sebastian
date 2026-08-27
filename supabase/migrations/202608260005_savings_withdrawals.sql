create or replace function public.validate_savings_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  balance_without_transaction numeric(14,2);
  resulting_balance numeric(14,2);
begin
  if tg_op = 'DELETE' then
    if old.savings_goal_id is null then
      return old;
    end if;

    select coalesce(sum(case when transaction_row.type = 'expense' then transaction_row.amount else -transaction_row.amount end), 0)
    into balance_without_transaction
    from public.transactions transaction_row
    where transaction_row.savings_goal_id = old.savings_goal_id
      and transaction_row.id <> old.id;

    if balance_without_transaction < 0 then
      raise exception 'This transaction cannot be removed because later withdrawals depend on it';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.savings_goal_id is not null and old.savings_goal_id is distinct from new.savings_goal_id then
    select coalesce(sum(case when transaction_row.type = 'expense' then transaction_row.amount else -transaction_row.amount end), 0)
    into balance_without_transaction
    from public.transactions transaction_row
    where transaction_row.savings_goal_id = old.savings_goal_id
      and transaction_row.id <> old.id;

    if balance_without_transaction < 0 then
      raise exception 'This transaction cannot be moved because later withdrawals depend on it';
    end if;
  end if;

  if new.savings_goal_id is null then
    return new;
  end if;

  perform 1
  from public.savings_goals goal
  where goal.id = new.savings_goal_id
    and goal.household_id = new.household_id
  for update;
  if not found then
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

  select coalesce(sum(case when transaction_row.type = 'expense' then transaction_row.amount else -transaction_row.amount end), 0)
  into balance_without_transaction
  from public.transactions transaction_row
  where transaction_row.savings_goal_id = new.savings_goal_id
    and transaction_row.id <> new.id;

  resulting_balance := balance_without_transaction + case when new.type = 'expense' then new.amount else -new.amount end;
  if resulting_balance < 0 then
    raise exception 'Withdrawal exceeds the available savings balance of %', balance_without_transaction;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_savings_transaction_before_change on public.transactions;
create trigger validate_savings_transaction_before_change
before insert or update or delete on public.transactions
for each row execute function public.validate_savings_transaction();

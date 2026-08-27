create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  target_date date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_amount <= target_amount)
);

create index savings_goals_household_target_idx
on public.savings_goals(household_id, target_date);

alter table public.savings_goals enable row level security;

create policy "members read savings goals" on public.savings_goals for select to authenticated
using (public.is_household_member(household_id));

create policy "editors manage savings goals" on public.savings_goals for all to authenticated
using (public.has_household_role(household_id, array['owner','admin','member']::public.household_role[]))
with check (public.has_household_role(household_id, array['owner','admin','member']::public.household_role[]));

create trigger set_savings_goals_updated_at before update on public.savings_goals
for each row execute function public.set_updated_at();

create trigger audit_savings_goals after insert or update or delete on public.savings_goals
for each row execute function public.write_audit_log();

alter publication supabase_realtime add table public.savings_goals;

create or replace function public.record_debt_payment(
  target_debt uuid,
  requested_amount numeric,
  paid_on date default current_date
)
returns public.debt_installments
language plpgsql
security definer
set search_path = ''
as $$
declare
  debt public.debt_installments%rowtype;
  applied_amount numeric(14,2);
begin
  select * into debt
  from public.debt_installments
  where id = target_debt
  for update;

  if debt.id is null or not public.has_household_role(debt.household_id, array['owner','admin','member']::public.household_role[]) then
    raise exception 'Installment not found';
  end if;

  if requested_amount <= 0 or debt.remaining_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  applied_amount := least(requested_amount, debt.remaining_amount);

  insert into public.transactions (
    household_id,
    type,
    amount,
    title,
    debt_installment_id,
    occurred_on,
    created_by
  ) values (
    debt.household_id,
    'expense',
    applied_amount,
    'Installment: ' || debt.title,
    debt.id,
    paid_on,
    auth.uid()
  );

  update public.debt_installments
  set
    remaining_amount = remaining_amount - applied_amount,
    status = case when remaining_amount - applied_amount <= 0 then 'paid' else 'active' end,
    next_due_date = case
      when remaining_amount - applied_amount <= 0 then null
      else (coalesce(next_due_date, paid_on) + interval '1 month')::date
    end
  where id = debt.id
  returning * into debt;

  return debt;
end;
$$;

revoke all on function public.record_debt_payment(uuid, numeric, date) from public;
grant execute on function public.record_debt_payment(uuid, numeric, date) to authenticated;

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
begin
  select * into goal
  from public.savings_goals
  where id = target_goal
  for update;

  if goal.id is null or not public.has_household_role(goal.household_id, array['owner','admin','member']::public.household_role[]) then
    raise exception 'Savings goal not found';
  end if;

  if requested_amount <= 0 then
    raise exception 'Contribution must be greater than zero';
  end if;

  update public.savings_goals
  set current_amount = least(target_amount, current_amount + requested_amount)
  where id = goal.id
  returning * into goal;

  return goal;
end;
$$;

revoke all on function public.contribute_to_savings(uuid, numeric) from public;
grant execute on function public.contribute_to_savings(uuid, numeric) to authenticated;

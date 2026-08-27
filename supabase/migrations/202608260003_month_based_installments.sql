alter table public.debt_installments
add column total_installments integer,
add column paid_installments integer;

update public.debt_installments
set
  total_installments = greatest(ceil(original_amount / installment_amount)::integer, 1),
  paid_installments = least(
    floor((original_amount - remaining_amount) / installment_amount)::integer,
    greatest(ceil(original_amount / installment_amount)::integer, 1)
  ),
  due_day = coalesce(due_day, extract(day from next_due_date)::smallint, 1);

alter table public.debt_installments
alter column total_installments set not null,
alter column paid_installments set not null,
alter column paid_installments set default 0,
alter column due_day set not null,
add constraint debt_installment_months_check check (
  total_installments > 0
  and paid_installments >= 0
  and paid_installments <= total_installments
);

drop function public.record_debt_payment(uuid, numeric, date);

create function public.record_debt_payment(
  target_debt uuid,
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
  next_month date;
  next_month_last_day integer;
begin
  select * into debt
  from public.debt_installments
  where id = target_debt
  for update;

  if debt.id is null or not public.has_household_role(debt.household_id, array['owner','admin','member']::public.household_role[]) then
    raise exception 'Installment not found';
  end if;

  if debt.remaining_amount <= 0 or debt.paid_installments >= debt.total_installments then
    raise exception 'Installment is already complete';
  end if;

  applied_amount := case
    when debt.paid_installments + 1 >= debt.total_installments then debt.remaining_amount
    else least(debt.installment_amount, debt.remaining_amount)
  end;

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

  next_month := (date_trunc('month', coalesce(debt.next_due_date, paid_on)) + interval '1 month')::date;
  next_month_last_day := extract(day from (next_month + interval '1 month - 1 day'))::integer;

  update public.debt_installments
  set
    remaining_amount = remaining_amount - applied_amount,
    paid_installments = least(total_installments, paid_installments + 1),
    status = case
      when remaining_amount - applied_amount <= 0 or paid_installments + 1 >= total_installments then 'paid'
      else 'active'
    end,
    next_due_date = case
      when remaining_amount - applied_amount <= 0 or paid_installments + 1 >= total_installments then null
      else next_month + (least(due_day::integer, next_month_last_day) - 1)
    end
  where id = debt.id
  returning * into debt;

  return debt;
end;
$$;

revoke all on function public.record_debt_payment(uuid, date) from public;
grant execute on function public.record_debt_payment(uuid, date) to authenticated;

alter table public.transactions
add column if not exists occurred_at time without time zone;

update public.transactions
set occurred_at = (created_at at time zone 'Asia/Bangkok')::time
where occurred_at is null;

alter table public.transactions
alter column occurred_at set default ((now() at time zone 'Asia/Bangkok')::time),
alter column occurred_at set not null;

create index if not exists transactions_household_datetime_idx
on public.transactions(household_id, occurred_on desc, occurred_at desc);

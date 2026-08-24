-- Sebastian household operating system
create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.household_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.money_type as enum ('income', 'expense');
create type public.calendar_item_type as enum ('event', 'reminder', 'planner', 'money', 'meal');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  display_name text,
  avatar_url text,
  locale text not null default 'en' check (locale in ('en', 'th')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency char(3) not null default 'THB',
  timezone text not null default 'Asia/Bangkok',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.household_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email citext not null,
  role public.household_role not null default 'member',
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, email)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  name_th text,
  color text not null default '#3a7d6f',
  icon text not null default 'circle',
  money_type public.money_type,
  created_at timestamptz not null default now(),
  unique (household_id, name)
);

create table public.debt_installments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  lender text,
  original_amount numeric(14,2) not null check (original_amount > 0),
  remaining_amount numeric(14,2) not null check (remaining_amount >= 0),
  installment_amount numeric(14,2) not null check (installment_amount > 0),
  interest_rate numeric(7,4),
  next_due_date date,
  due_day smallint check (due_day between 1 and 31),
  status text not null default 'active' check (status in ('active', 'paid', 'paused')),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  type public.money_type not null,
  amount numeric(14,2) not null check (amount > 0),
  title text not null,
  category_id uuid references public.categories(id) on delete set null,
  debt_installment_id uuid references public.debt_installments(id) on delete set null,
  occurred_on date not null default current_date,
  notes text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_household_date_idx on public.transactions(household_id, occurred_on desc);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_type public.calendar_item_type not null default 'event',
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  reminder_minutes integer[],
  recurrence_rule text,
  related_transaction_id uuid references public.transactions(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index calendar_events_household_starts_idx on public.calendar_events(household_id, starts_at);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  title_th text,
  description text,
  image_path text,
  prep_minutes integer check (prep_minutes >= 0),
  cook_minutes integer check (cook_minutes >= 0),
  servings numeric(6,2) check (servings > 0),
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  tags text[] not null default '{}',
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  planned_for date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid references public.recipes(id) on delete set null,
  custom_title text,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recipe_id is not null or custom_title is not null),
  unique (household_id, planned_for, meal_type)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity_type text not null,
  entity_id text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_household_created_idx on public.audit_logs(household_id, created_at desc);

-- Security-definer helpers avoid recursive RLS checks.
create or replace function public.is_household_member(target_household uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid()
  );
$$;

create or replace function public.has_household_role(target_household uuid, allowed public.household_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid() and role = any(allowed)
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.has_household_role(uuid, public.household_role[]) from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.has_household_role(uuid, public.household_role[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.invitations enable row level security;
alter table public.categories enable row level security;
alter table public.debt_installments enable row level security;
alter table public.transactions enable row level security;
alter table public.calendar_events enable row level security;
alter table public.recipes enable row level security;
alter table public.meal_plans enable row level security;
alter table public.audit_logs enable row level security;

create policy "users read their profile and housemates" on public.profiles for select to authenticated
using (id = auth.uid() or exists (
  select 1 from public.household_members mine
  join public.household_members theirs on theirs.household_id = mine.household_id
  where mine.user_id = auth.uid() and theirs.user_id = profiles.id
));
create policy "users update their profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "members read households" on public.households for select to authenticated using (public.is_household_member(id));
create policy "owners update households" on public.households for update to authenticated
using (public.has_household_role(id, array['owner','admin']::public.household_role[]))
with check (public.has_household_role(id, array['owner','admin']::public.household_role[]));

create policy "members read memberships" on public.household_members for select to authenticated using (public.is_household_member(household_id));
create policy "owners manage memberships" on public.household_members for all to authenticated
using (public.has_household_role(household_id, array['owner','admin']::public.household_role[]))
with check (public.has_household_role(household_id, array['owner','admin']::public.household_role[]));

create policy "members read invitations" on public.invitations for select to authenticated using (public.is_household_member(household_id));
create policy "owners manage invitations" on public.invitations for all to authenticated
using (public.has_household_role(household_id, array['owner','admin']::public.household_role[]))
with check (public.has_household_role(household_id, array['owner','admin']::public.household_role[]));

-- All active members can collaborate on household content. Viewer is read-only.
create policy "members read categories" on public.categories for select to authenticated using (public.is_household_member(household_id));
create policy "editors manage categories" on public.categories for all to authenticated
using (public.has_household_role(household_id, array['owner','admin','member']::public.household_role[]))
with check (public.has_household_role(household_id, array['owner','admin','member']::public.household_role[]));

do $$
declare table_name text;
begin
  foreach table_name in array array['debt_installments','transactions','calendar_events','recipes','meal_plans'] loop
    execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using (public.is_household_member(household_id))', table_name);
    execute format('create policy "editors manage %1$s" on public.%1$I for all to authenticated using (public.has_household_role(household_id, array[''owner'',''admin'',''member'']::public.household_role[])) with check (public.has_household_role(household_id, array[''owner'',''admin'',''member'']::public.household_role[]))', table_name);
  end loop;
end $$;

create policy "members read audit log" on public.audit_logs for select to authenticated using (public.is_household_member(household_id));

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','households','debt_installments','transactions','calendar_events','recipes','meal_plans'] loop
    execute format('create trigger set_%1$s_updated_at before update on public.%1$I for each row execute function public.set_updated_at()', table_name);
  end loop;
end $$;

create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare payload jsonb;
declare target_household uuid;
declare target_id text;
begin
  payload := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_household := (payload ->> 'household_id')::uuid;
  target_id := coalesce(payload ->> 'id', payload ->> 'user_id');
  insert into public.audit_logs(household_id, actor_id, action, entity_type, entity_id, old_data, new_data)
  values (target_household, auth.uid(), tg_op, tg_table_name, target_id,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['household_members','invitations','categories','debt_installments','transactions','calendar_events','recipes','meal_plans'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.write_audit_log()', table_name);
  end loop;
end $$;

-- Bootstrap the master account and automatically accept matching invitations.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare new_household uuid;
declare pending_invite public.invitations%rowtype;
begin
  insert into public.profiles(id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  if lower(new.email) = 's4nthiti@gmail.com' then
    insert into public.households(name, created_by) values ('Sebastian Home', new.id) returning id into new_household;
    insert into public.household_members(household_id, user_id, role) values (new_household, new.id, 'owner');
    insert into public.categories(household_id, name, name_th, color, icon, money_type) values
      (new_household, 'Salary', 'เงินเดือน', '#3a7d6f', 'wallet', 'income'),
      (new_household, 'Groceries', 'ของใช้และอาหาร', '#ff7b54', 'basket', 'expense'),
      (new_household, 'Home', 'บ้าน', '#e7b25b', 'house', 'expense'),
      (new_household, 'Transport', 'เดินทาง', '#8a78c2', 'train', 'expense'),
      (new_household, 'Subscriptions', 'สมาชิกบริการ', '#718f87', 'credit-card', 'expense');
  else
    select * into pending_invite from public.invitations
    where lower(email) = lower(new.email) and accepted_at is null and expires_at > now()
    order by created_at desc limit 1 for update;
    if found then
      insert into public.household_members(household_id, user_id, role)
      values (pending_invite.household_id, new.id, pending_invite.role);
      update public.invitations set accepted_at = now() where id = pending_invite.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Recipe images are stored by household id: <household-id>/<filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "members upload recipe images" on storage.objects for insert to authenticated
with check (bucket_id = 'recipe-images' and public.is_household_member((storage.foldername(name))[1]::uuid));
create policy "members update recipe images" on storage.objects for update to authenticated
using (bucket_id = 'recipe-images' and public.is_household_member((storage.foldername(name))[1]::uuid));
create policy "members delete recipe images" on storage.objects for delete to authenticated
using (bucket_id = 'recipe-images' and public.is_household_member((storage.foldername(name))[1]::uuid));

-- Realtime collaboration (RLS still applies to every subscriber).
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.debt_installments;
alter publication supabase_realtime add table public.calendar_events;
alter publication supabase_realtime add table public.recipes;
alter publication supabase_realtime add table public.meal_plans;

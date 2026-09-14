-- Subscription Payment Tracker
-- Run this entire migration in Supabase SQL Editor.

create extension if not exists pgcrypto;

create type public.app_role as enum ('ADMIN', 'GUEST');
create type public.subscription_status as enum ('ACTIVE', 'CANCELLED');
create type public.payment_status as enum ('PENDING', 'PAID', 'OVERDUE', 'WAIVED');

create table public.members (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.app_role not null default 'GUEST',
  member_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider text,
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'MYR' check (currency = 'MYR'),
  billing_frequency text not null default 'MONTHLY' check (billing_frequency in ('MONTHLY','YEARLY')),
  billing_day integer not null default 1 check (billing_day between 1 and 31),
  start_date date not null default current_date,
  end_date date,
  status public.subscription_status not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_price_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  price numeric(12,2) not null check (price >= 0),
  effective_from date not null,
  effective_to date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.subscription_members (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete restrict,
  joined_date date not null default current_date,
  left_date date,
  monthly_amount numeric(12,2) not null check (monthly_amount >= 0),
  amount_effective_from date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, member_id),
  check (left_date is null or left_date >= joined_date)
);

create table public.billing_periods (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  created_at timestamptz not null default now(),
  unique (subscription_id, period_start)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  billing_period_id uuid not null references public.billing_periods(id) on delete restrict,
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete restrict,
  amount_due numeric(12,2) not null check (amount_due >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  status public.payment_status not null default 'PENDING',
  due_date date not null,
  payment_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (billing_period_id, member_id)
);

create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  content_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index idx_payments_due_date on public.payments(due_date);
create index idx_payments_member on public.payments(member_id);
create index idx_payments_subscription on public.payments(subscription_id);
create index idx_subscription_members_member on public.subscription_members(member_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger members_updated_at before update on public.members
for each row execute function public.set_updated_at();

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger subscriptions_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

create trigger subscription_members_updated_at before update on public.subscription_members
for each row execute function public.set_updated_at();

create trigger payments_updated_at before update on public.payments
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'ADMIN'
  );
$$;

create or replace function public.my_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select member_id from public.profiles where id = auth.uid();
$$;

-- Snapshot billing-period generation.
-- Existing periods are reused; existing payment rows are never changed.
create or replace function public.generate_billing_period(
  p_subscription_id uuid,
  p_period_start date
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_period_id uuid;
  v_period_end date;
  v_due_date date;
  v_created integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can generate billing periods';
  end if;

  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'Subscription not found'; end if;

  if v_sub.billing_frequency = 'YEARLY' then
    v_period_end := (p_period_start + interval '1 year - 1 day')::date;
  else
    v_period_end := (p_period_start + interval '1 month - 1 day')::date;
  end if;

  v_due_date := make_date(
    extract(year from p_period_start)::int,
    extract(month from p_period_start)::int,
    least(v_sub.billing_day, extract(day from (date_trunc('month', p_period_start) + interval '1 month - 1 day'))::int)
  );

  insert into public.billing_periods (subscription_id, period_start, period_end, due_date)
  values (p_subscription_id, p_period_start, v_period_end, v_due_date)
  on conflict (subscription_id, period_start)
  do update set due_date = excluded.due_date
  returning id into v_period_id;

  insert into public.payments (
    billing_period_id, subscription_id, member_id, amount_due, amount_paid, status, due_date
  )
  select
    v_period_id,
    sm.subscription_id,
    sm.member_id,
    sm.monthly_amount,
    0,
    case when v_due_date < current_date then 'OVERDUE'::public.payment_status else 'PENDING'::public.payment_status end,
    v_due_date
  from public.subscription_members sm
  where sm.subscription_id = p_subscription_id
    and sm.joined_date <= v_period_end
    and (sm.left_date is null or sm.left_date >= p_period_start)
    and not exists (
      select 1 from public.payments p
      where p.billing_period_id = v_period_id
        and p.member_id = sm.member_id
    );

  get diagnostics v_created = row_count;

  return json_build_object(
    'billing_period_id', v_period_id,
    'created_count', v_created,
    'period_start', p_period_start,
    'due_date', v_due_date
  );
end;
$$;

create or replace view public.payment_report as
select
  p.id,
  p.due_date,
  p.amount_due,
  p.amount_paid,
  p.status,
  p.payment_date,
  m.nickname,
  s.name as subscription_name,
  s.provider
from public.payments p
join public.members m on m.id = p.member_id
join public.subscriptions s on s.id = p.subscription_id;

-- RLS
alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_price_history enable row level security;
alter table public.subscription_members enable row level security;
alter table public.billing_periods enable row level security;
alter table public.payments enable row level security;
alter table public.payment_receipts enable row level security;

-- Profiles: users can read their own profile; admins can manage all profiles.
create policy profiles_select_self on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());

create policy profiles_update_self_or_admin on public.profiles
for update to authenticated using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Members
create policy members_admin_all on public.members
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy members_guest_self on public.members
for select to authenticated using (id = public.my_member_id());

-- Subscriptions
create policy subscriptions_admin_all on public.subscriptions
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy subscriptions_guest_read on public.subscriptions
for select to authenticated using (
  exists (
    select 1 from public.subscription_members sm
    where sm.subscription_id = subscriptions.id
      and sm.member_id = public.my_member_id()
  )
);

-- Price history
create policy price_history_admin_all on public.subscription_price_history
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy price_history_guest_read on public.subscription_price_history
for select to authenticated using (
  exists (
    select 1 from public.subscription_members sm
    where sm.subscription_id = subscription_price_history.subscription_id
      and sm.member_id = public.my_member_id()
  )
);

-- Subscription members
create policy subscription_members_admin_all on public.subscription_members
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy subscription_members_guest_read on public.subscription_members
for select to authenticated using (member_id = public.my_member_id());

-- Billing periods
create policy billing_periods_admin_all on public.billing_periods
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy billing_periods_guest_read on public.billing_periods
for select to authenticated using (
  exists (
    select 1 from public.subscription_members sm
    where sm.subscription_id = billing_periods.subscription_id
      and sm.member_id = public.my_member_id()
  )
);

-- Payments
create policy payments_admin_all on public.payments
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy payments_guest_read_own on public.payments
for select to authenticated using (member_id = public.my_member_id());

-- Receipts
create policy receipts_admin_all on public.payment_receipts
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy receipts_guest_read_own on public.payment_receipts
for select to authenticated using (
  exists (
    select 1 from public.payments p
    where p.id = payment_receipts.payment_id
      and p.member_id = public.my_member_id()
  )
);

-- Grants
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.generate_billing_period(uuid, date) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_member_id() to authenticated;

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do nothing;

create policy receipt_upload_admin on storage.objects
for insert to authenticated
with check (bucket_id = 'payment-receipts' and public.is_admin());

create policy receipt_read_admin_or_owner on storage.objects
for select to authenticated
using (
  bucket_id = 'payment-receipts'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.payment_receipts pr
      join public.payments p on p.id = pr.payment_id
      where pr.storage_path = name
        and p.member_id = public.my_member_id()
    )
  )
);

create policy receipt_delete_admin on storage.objects
for delete to authenticated
using (bucket_id = 'payment-receipts' and public.is_admin());

-- Seed no application data. Create your first Auth user in Supabase Dashboard.

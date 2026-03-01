-- Supabase schema for FleetFlow
-- Run this in your Supabase SQL editor

-- Enable RLS
alter table auth.users enable row level security;

-- Users table (extends auth.users)
create table if not exists public.users (
  id uuid references auth.users(id) primary key,
  email text unique not null,
  name text,
  role text default 'fleet_manager',
  company text,
  two_factor_enabled boolean default false,
  two_factor_secret text,
  backup_codes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS on users
alter table public.users enable row level security;

-- RLS policies for users
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- Teams table
create table if not exists public.teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  owner_id uuid references public.users(id) not null,
  logo text,
  address text,
  phone text,
  business_hours text,
  branding jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Team members table
create table if not exists public.team_members (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  role text default 'MEMBER',
  invited_by uuid references public.users(id),
  invited_at timestamp with time zone default now(),
  joined_at timestamp with time zone,
  status text default 'PENDING',
  unique(team_id, user_id)
);

-- Vehicles table
create table if not exists public.vehicles (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade,
  name text not null,
  type text,
  license_plate text,
  vin text,
  year integer,
  make text,
  model text,
  status text default 'active',
  mileage integer,
  fuel_type text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Maintenance records
create table if not exists public.maintenance_records (
  id uuid default gen_random_uuid() primary key,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  service_type text not null,
  description text,
  cost decimal(10,2),
  mileage integer,
  service_date date,
  next_service_date date,
  next_service_mileage integer,
  status text default 'completed',
  created_by uuid references public.users(id),
  created_at timestamp with time zone default now()
);

-- Deliveries table
create table if not exists public.deliveries (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id),
  driver_id uuid references public.users(id),
  pickup_address text not null,
  delivery_address text not null,
  status text default 'pending',
  scheduled_date timestamp with time zone,
  completed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Notifications table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  data jsonb,
  read boolean default false,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- API Keys table
create table if not exists public.api_keys (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  key_hash text unique not null,
  last_used_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Subscriptions table
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  plan text default 'PER_USER',
  status text default 'TRIAL',
  trial_ends_at timestamp with time zone,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create indexes
create index idx_users_email on public.users(email);
create index idx_team_members_user_id on public.team_members(user_id);
create index idx_team_members_team_id on public.team_members(team_id);
create index idx_vehicles_team_id on public.vehicles(team_id);
create index idx_deliveries_team_id on public.deliveries(team_id);
create index idx_notifications_user_id on public.notifications(user_id);
create index idx_notifications_read on public.notifications(user_id, read);

-- Function to handle user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    coalesce(new.raw_user_meta_data->>'role', 'fleet_manager')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create user profile on auth signup
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

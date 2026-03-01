-- Enable extensions
create extension if not exists vector;
create extension if not exists "uuid-ossp";

-- Drop tables if they exist (for clean re-runs)
drop table if exists notifications cascade;
drop table if exists blocks cascade;
drop table if exists messages cascade;
drop table if exists connections cascade;
drop table if exists matches cascade;
drop table if exists profiles cascade;

-- Profiles table
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text,
  image_url text,
  bio text,
  ikigai_love text,
  ikigai_good_at text,
  ikigai_world_needs text,
  ikigai_paid_for text,
  ikigai_mission text,
  skills text[] default '{}',
  interests text[] default '{}',
  availability text check (availability in ('full_time', 'part_time', 'weekends')),
  working_style text check (working_style in ('async', 'sync', 'hybrid')),
  intent text[] default '{}',
  portfolio_url text,
  linkedin_url text,
  github_url text,
  twitter_url text,
  cv_url text,
  is_public boolean default true,
  profile_completion_score integer default 0,
  match_criteria jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Matches table
create table matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  matched_profile_id uuid references profiles(id) on delete cascade,
  score float default 0,
  one_liner text,
  explanation text,
  computed_at timestamptz default now(),
  unique(user_id, matched_profile_id)
);

-- Connections table
create table connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references profiles(id) on delete cascade,
  receiver_id uuid references profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now(),
  unique(requester_id, receiver_id)
);

-- Messages table
create table messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references connections(id) on delete cascade,
  sender_id uuid references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now(),
  read_at timestamptz
);

-- Blocks table
create table blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid references profiles(id) on delete cascade,
  blocked_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(blocker_id, blocked_id)
);

-- Notifications table
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text check (type in ('connection_request', 'message', 'match')),
  content text,
  reference_id uuid,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- Updated at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- RLS
alter table profiles enable row level security;
alter table matches enable row level security;
alter table connections enable row level security;
alter table messages enable row level security;
alter table blocks enable row level security;
alter table notifications enable row level security;

-- Profile policies
create policy "Public profiles viewable by everyone"
  on profiles for select using (is_public = true);

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = user_id);

-- Match policies
create policy "Users can view own matches"
  on matches for select using (
    user_id in (select id from profiles where user_id = auth.uid())
  );

create policy "Service role can manage matches"
  on matches for all using (true);

-- Connection policies
create policy "Users can view own connections"
  on connections for select using (
    requester_id in (select id from profiles where user_id = auth.uid()) or
    receiver_id in (select id from profiles where user_id = auth.uid())
  );

create policy "Users can insert connections"
  on connections for insert with check (
    requester_id in (select id from profiles where user_id = auth.uid())
  );

create policy "Users can update own connections"
  on connections for update using (
    requester_id in (select id from profiles where user_id = auth.uid()) or
    receiver_id in (select id from profiles where user_id = auth.uid())
  );

-- Message policies
create policy "Users can view messages in their connections"
  on messages for select using (
    connection_id in (
      select id from connections where
        requester_id in (select id from profiles where user_id = auth.uid()) or
        receiver_id in (select id from profiles where user_id = auth.uid())
    )
  );

create policy "Users can insert messages in their connections"
  on messages for insert with check (
    connection_id in (
      select id from connections where
        status = 'accepted' and (
          requester_id in (select id from profiles where user_id = auth.uid()) or
          receiver_id in (select id from profiles where user_id = auth.uid())
        )
    )
  );

-- Notification policies
create policy "Users can view own notifications"
  on notifications for select using (
    user_id in (select id from profiles where user_id = auth.uid())
  );

create policy "Users can update own notifications"
  on notifications for update using (
    user_id in (select id from profiles where user_id = auth.uid())
  );

-- Block policies
create policy "Users can manage own blocks"
  on blocks for all using (
    blocker_id in (select id from profiles where user_id = auth.uid())
  );

-- Realtime
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table connections;

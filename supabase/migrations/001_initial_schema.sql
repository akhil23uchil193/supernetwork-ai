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

create policy "Authenticated users can insert notifications"
  on notifications for insert with check (auth.uid() is not null);

-- Block policies
create policy "Users can manage own blocks"
  on blocks for all using (
    blocker_id in (select id from profiles where user_id = auth.uid())
  );

-- Realtime
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table connections;

-- =============================================
-- BLOCK ENFORCEMENT AT DATABASE LEVEL
-- =============================================

-- Helper function to get all blocked profile ids (both directions)
-- Used for: matches, messages, connections, notifications
-- (anywhere we want mutual hiding)
CREATE OR REPLACE FUNCTION get_blocked_profile_ids(current_profile_id uuid)
RETURNS uuid[] AS $$
  SELECT ARRAY(
    SELECT blocked_id FROM blocks WHERE blocker_id = current_profile_id
    UNION
    SELECT blocker_id FROM blocks WHERE blocked_id = current_profile_id
  )
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get profile ids that have blocked the current user (one direction only)
-- Used for: profiles SELECT policy
-- The blocker can still see profiles they've blocked (needed for the unblock list),
-- but someone who blocked you cannot see your profile.
CREATE OR REPLACE FUNCTION get_profiles_who_blocked_me(current_profile_id uuid)
RETURNS uuid[] AS $$
  SELECT ARRAY(
    SELECT blocker_id FROM blocks WHERE blocked_id = current_profile_id
  )
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper to get current user's profile id
CREATE OR REPLACE FUNCTION get_current_profile_id()
RETURNS uuid AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================
-- MATCHES: blocked users don't appear in matches
-- =============================================
DROP POLICY IF EXISTS "Users can view own matches" ON matches;
CREATE POLICY "Users can view own matches"
  ON matches FOR SELECT USING (
    user_id = get_current_profile_id()
    AND matched_profile_id != ALL(
      get_blocked_profile_ids(get_current_profile_id())
    )
  );

-- =============================================
-- MESSAGES: blocked users cannot send messages
-- =============================================
DROP POLICY IF EXISTS "Users can insert messages in their connections" ON messages;
CREATE POLICY "Users can insert messages in their connections"
  ON messages FOR INSERT WITH CHECK (
    -- Must be part of the connection
    connection_id IN (
      SELECT id FROM connections WHERE
        status = 'accepted' AND (
          requester_id = get_current_profile_id() OR
          receiver_id = get_current_profile_id()
        )
    )
    -- Sender must not be blocked by receiver
    AND sender_id != ALL(
      get_blocked_profile_ids(get_current_profile_id())
    )
    -- Cannot send to someone who blocked you
    AND get_current_profile_id() != ALL(
      get_blocked_profile_ids(
        (SELECT 
          CASE 
            WHEN requester_id = get_current_profile_id() THEN receiver_id
            ELSE requester_id
          END
        FROM connections WHERE id = connection_id)
      )
    )
  );

-- =============================================
-- MESSAGES: blocked users messages not visible
-- =============================================
DROP POLICY IF EXISTS "Users can view messages in their connections" ON messages;
CREATE POLICY "Users can view messages in their connections"
  ON messages FOR SELECT USING (
    connection_id IN (
      SELECT id FROM connections WHERE
        requester_id = get_current_profile_id() OR
        receiver_id = get_current_profile_id()
    )
    -- Don't show messages from blocked users
    AND sender_id != ALL(
      get_blocked_profile_ids(get_current_profile_id())
    )
  );

-- =============================================
-- NOTIFICATIONS: don't show from blocked users
-- =============================================
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT USING (
    user_id = get_current_profile_id()
    AND (
      reference_id IS NULL
      OR reference_id != ALL(
        get_blocked_profile_ids(get_current_profile_id())
      )
    )
  );

-- =============================================
-- CONNECTIONS: blocked users can't send requests
-- =============================================
DROP POLICY IF EXISTS "Users can insert connections" ON connections;
CREATE POLICY "Users can insert connections"
  ON connections FOR INSERT WITH CHECK (
    requester_id = get_current_profile_id()
    -- Cannot connect with blocked users
    AND receiver_id != ALL(
      get_blocked_profile_ids(get_current_profile_id())
    )
  );

-- =============================================
-- PROFILES: block enforcement via SECURITY DEFINER functions.
-- Using raw "SELECT ... FROM blocks" inside a profiles policy causes
-- infinite recursion: profiles RLS → blocks RLS → profiles RLS.
-- SECURITY DEFINER functions bypass RLS internally, breaking the cycle.
-- =============================================
DROP POLICY IF EXISTS "Public profiles viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

CREATE POLICY "Public profiles viewable by everyone"
  ON profiles FOR SELECT USING (
    is_public = true
    AND (
      auth.uid() IS NULL
      OR id != ALL(get_profiles_who_blocked_me(get_current_profile_id()))
    )
  );

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- MESSAGES: re-apply INSERT policy with block guard
-- (ensures blocked users cannot send messages even if they bypass
-- the connection check somehow)
-- =============================================
DROP POLICY IF EXISTS "Users can insert messages in their connections" ON messages;
CREATE POLICY "Users can insert messages in their connections"
  ON messages FOR INSERT WITH CHECK (
    connection_id IN (
      SELECT id FROM connections WHERE
        status = 'accepted' AND (
          requester_id = get_current_profile_id() OR
          receiver_id = get_current_profile_id()
        )
    )
    AND (
      SELECT CASE
        WHEN c.requester_id = get_current_profile_id() THEN c.receiver_id
        ELSE c.requester_id
      END
      FROM connections c WHERE c.id = connection_id
    ) != ALL(get_blocked_profile_ids(get_current_profile_id()))
  );
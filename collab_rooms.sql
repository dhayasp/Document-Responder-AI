-- SQL Script: Collaborative Rooms and Members Management

-- 1. Create the Collab Rooms table
create table if not exists public.collab_rooms (
  id text primary key, -- matches session_id (e.g. collab-1234)
  owner_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create the Collab Members table
create table if not exists public.collab_members (
  room_id text references public.collab_rooms(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (room_id, user_id)
);

-- disable RLS for smooth client-side operations (or set up proper RLS if required later)
ALTER TABLE collab_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE collab_members DISABLE ROW LEVEL SECURITY;

-- 3. ENABLE REALTIME SYNC FOR MESSAGES 
-- If chat messages in shared rooms aren't updating live without refreshing, 
-- you must manually enable Realtime replication for the 'chat_history' table
-- by running this simple command in your Supabase SQL Editor:

ALTER PUBLICATION supabase_realtime ADD TABLE chat_history;

-- (If it gives an error saying it is already added, you can safely ignore it!)

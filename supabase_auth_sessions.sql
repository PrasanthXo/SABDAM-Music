-- SABDHAM durable auth sessions
-- Run ONCE in Supabase SQL Editor.

create table if not exists public.auth_sessions (
  token_hash text primary key,
  user_uid text not null references public.users(uid) on delete cascade,
  email text not null,
  provider text not null default 'otp',
  expires_at timestamp not null,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index if not exists auth_sessions_user_uid_idx
  on public.auth_sessions(user_uid);

create index if not exists auth_sessions_expires_at_idx
  on public.auth_sessions(expires_at);

-- Remove any pre-existing duplicate favorite rows before adding uniqueness.
delete from public.user_favorites a
using public.user_favorites b
where a.id > b.id
  and a.user_uid = b.user_uid
  and a.track_id = b.track_id;

create unique index if not exists user_favorites_user_track_uidx
  on public.user_favorites(user_uid, track_id);

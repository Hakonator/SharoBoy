create table public.sharoboy_custom_maps (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 60),
  description text not null default '' check (char_length(description) <= 300),
  author_nick text not null,
  spec_json jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text default null,
  likes_count integer not null default 0 check (likes_count >= 0),
  plays_count integer not null default 0 check (plays_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sharoboy_map_votes (
  id bigint generated always as identity primary key,
  map_id uuid not null references public.sharoboy_custom_maps(id) on delete cascade,
  voter_id text not null,
  created_at timestamptz not null default now(),
  unique (map_id, voter_id)
);

create index sharoboy_custom_maps_status_idx on public.sharoboy_custom_maps (status);
create index sharoboy_custom_maps_popular_idx on public.sharoboy_custom_maps (likes_count desc, created_at desc);
create index sharoboy_custom_maps_newest_idx on public.sharoboy_custom_maps (created_at desc);

alter table public.sharoboy_custom_maps enable row level security;
alter table public.sharoboy_map_votes enable row level security;

create policy "approved custom maps are publicly readable"
  on public.sharoboy_custom_maps for select
  to anon, authenticated
  using (status = 'approved');

revoke all on public.sharoboy_custom_maps from anon, authenticated;
grant select on public.sharoboy_custom_maps to anon, authenticated;
revoke all on public.sharoboy_map_votes from anon, authenticated;

create or replace function public.sharoboy_increment_map_plays(map_uuid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.sharoboy_custom_maps
  set plays_count = plays_count + 1, updated_at = now()
  where id = map_uuid and status = 'approved';
$$;

create or replace function public.sharoboy_increment_map_likes(map_uuid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.sharoboy_custom_maps
  set likes_count = likes_count + 1, updated_at = now()
  where id = map_uuid and status = 'approved';
$$;

revoke all on function public.sharoboy_increment_map_plays(uuid) from public, anon, authenticated;
revoke all on function public.sharoboy_increment_map_likes(uuid) from public, anon, authenticated;
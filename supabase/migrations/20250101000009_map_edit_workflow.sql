alter table public.sharoboy_custom_maps
  add column if not exists map_uid text,
  add column if not exists edit_status text not null default 'none',
  add column if not exists edit_request_reason text default null;

alter table public.sharoboy_custom_maps
  drop constraint if exists sharoboy_custom_maps_edit_status_check;

alter table public.sharoboy_custom_maps
  add constraint sharoboy_custom_maps_edit_status_check
  check (edit_status in ('none', 'requested', 'approved'));

create unique index if not exists sharoboy_custom_maps_pending_author_title_uidx
  on public.sharoboy_custom_maps (author_nick, lower(title))
  where status = 'pending';

create unique index if not exists sharoboy_custom_maps_pending_uid_uidx
  on public.sharoboy_custom_maps (map_uid)
  where status = 'pending' and map_uid is not null;

create index if not exists sharoboy_custom_maps_edit_status_idx
  on public.sharoboy_custom_maps (edit_status)
  where edit_status <> 'none';
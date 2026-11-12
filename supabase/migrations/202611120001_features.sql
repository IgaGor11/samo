alter table public.channels add column if not exists next_run_at timestamptz not null default now();
alter table public.channels add column if not exists last_error text;
alter table public.posts add column if not exists source_url text;
alter table public.posts add column if not exists updated_at timestamptz not null default now();
create unique index if not exists posts_source on public.posts(channel_id,source_url) where source_url is not null;
create table if not exists public.attachments (
 id uuid primary key default gen_random_uuid(), owner_id bigint not null references public.accounts(telegram_id) on delete cascade,
 file_id text not null, kind text not null check(kind in ('photo','video','video_note')), label text not null default '',
 source_message_id bigint, created_at timestamptz not null default now(), unique(owner_id,source_message_id)
);
create table if not exists public.media_jobs (
 id uuid primary key default gen_random_uuid(), owner_id bigint not null references public.accounts(telegram_id) on delete cascade,
 prediction_id text not null unique, purpose text not null, status text not null default 'starting', attachment_id uuid,
 created_at timestamptz not null default now(), message text
);
create table if not exists public.request_limits (
 owner_id bigint not null references public.accounts(telegram_id) on delete cascade, bucket text not null, count integer not null default 0,
 primary key(owner_id,bucket)
);
alter table public.request_limits add column if not exists created_at timestamptz not null default now();
create or replace function public.take_request(p_owner bigint,p_bucket text,p_limit integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
 insert into request_limits(owner_id,bucket,count) values(p_owner,p_bucket,1)
 on conflict(owner_id,bucket) do update set count=request_limits.count+1 where request_limits.count<p_limit returning count into n;
 return n is not null;
end; $$;
alter table public.attachments enable row level security;
alter table public.media_jobs enable row level security;
alter table public.request_limits enable row level security;
revoke all on public.attachments,public.media_jobs,public.request_limits from anon,authenticated;
revoke all on function public.take_request(bigint,text,integer) from public,anon,authenticated;
grant execute on function public.take_request(bigint,text,integer) to service_role;

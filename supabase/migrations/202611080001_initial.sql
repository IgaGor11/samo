-- API operates through verified Telegram sessions in Edge Functions.
-- No direct browser access to tenant data is granted.
create table public.accounts (
  telegram_id bigint primary key,
  created_at timestamptz not null default now()
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  owner_id bigint not null references public.accounts(telegram_id) on delete cascade,
  telegram_chat_id bigint not null unique,
  title text not null,
  kind text not null check (kind in ('news','product','personal','character')),
  enabled boolean not null default false,
  moderation boolean not null default true,
  timezone text not null default 'Europe/Moscow',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(id, owner_id)
);

create table public.ai_credentials (
  id uuid primary key default gen_random_uuid(),
  owner_id bigint not null references public.accounts(telegram_id) on delete cascade,
  purpose text not null check (purpose in ('text','image','video','speech','search')),
  provider text not null,
  model text not null,
  encrypted_secret text not null,
  unique(owner_id, purpose)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null,
  owner_id bigint not null,
  status text not null default 'draft' check (status in ('draft','scheduled','publishing','published','failed','uncertain')),
  content text not null default '',
  media jsonb not null default '[]',
  scheduled_at timestamptz,
  telegram_message_id bigint,
  created_at timestamptz not null default now(),
  foreign key(channel_id, owner_id) references public.channels(id, owner_id) on delete cascade
);

alter table public.accounts enable row level security;
alter table public.channels enable row level security;
alter table public.ai_credentials enable row level security;
alter table public.posts enable row level security;
revoke all on public.accounts, public.channels, public.ai_credentials, public.posts from anon, authenticated;
create index posts_due on public.posts(scheduled_at) where status = 'scheduled';
create index channels_owner on public.channels(owner_id);

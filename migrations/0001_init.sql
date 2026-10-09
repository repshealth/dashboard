-- REPS Scaling OS on Cloudflare D1.
-- Everything is stored as JSON documents of a few kinds, in one table. The app's
-- own code (lib/backend/core.ts) decides who can see and change what.
--
-- Apply with: npx wrangler d1 migrations apply reps-scaling-os --remote

create table if not exists docs (
  kind text not null,        -- client, lead, site, campaign, submission, meeting, voice, user, session, token, ...
  id text not null,
  client_id text,            -- which client account it belongs to
  key text,                  -- unique lookup within the kind: client slug, user email, lead client|email, meeting key
  sort text,                 -- lists are newest first by this (usually a date)
  rev integer not null default 1,
  data text not null,        -- the document, as JSON
  primary key (kind, id)
);

create index if not exists docs_by_client on docs (kind, client_id, sort);
create unique index if not exists docs_by_key on docs (kind, key) where key is not null;

-- ============================================================
-- TRW LAW FIRM - SUPABASE SCHEMA
-- Run this entire file in Supabase > SQL Editor
-- ============================================================

-- 1. PROFILES TABLE (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('associate', 'partner')),
  created_at timestamptz default now()
);

-- 2. CASES TABLE
create table public.cases (
  id uuid default gen_random_uuid() primary key,
  file_number text,                      -- internal reference number
  client_name text not null,
  client_contact text,                   -- phone or email
  case_type text not null,               -- e.g. Corporate, Civil, Criminal
  opposing_party text,
  court_name text,
  court_case_number text,
  status text not null default 'open' check (status in ('open', 'closed', 'pending')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. TIMELINE ENTRIES TABLE
create table public.timeline_entries (
  id uuid default gen_random_uuid() primary key,
  case_id uuid references public.cases(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete set null,
  entry_text text not null,
  created_at timestamptz default now()
);

-- 4. DOCUMENTS TABLE
create table public.documents (
  id uuid default gen_random_uuid() primary key,
  case_id uuid references public.cases(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete set null,
  file_name text not null,
  file_path text not null,              -- path in Supabase Storage
  file_type text,
  file_size bigint,
  uploaded_at timestamptz default now()
);

-- 5. DEADLINES TABLE
create table public.deadlines (
  id uuid default gen_random_uuid() primary key,
  case_id uuid references public.cases(id) on delete cascade not null,
  title text not null,
  due_date date not null,
  notes text,
  is_complete boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.timeline_entries enable row level security;
alter table public.documents enable row level security;
alter table public.deadlines enable row level security;

-- PROFILES: everyone can read, only own profile can update
create policy "profiles_read_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- CASES: partners see all, associates see only their own
create policy "cases_partner_all" on public.cases
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'partner')
  );

create policy "cases_associate_own" on public.cases
  for all using (
    assigned_to = auth.uid() and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'associate')
  );

-- TIMELINE: partners see all; associates see their own cases only
create policy "timeline_partner_all" on public.timeline_entries
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'partner')
  );

create policy "timeline_associate_own_case" on public.timeline_entries
  for all using (
    exists (
      select 1 from public.cases
      where cases.id = timeline_entries.case_id
        and cases.assigned_to = auth.uid()
    )
  );

-- DOCUMENTS: same pattern as timeline
create policy "documents_partner_all" on public.documents
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'partner')
  );

create policy "documents_associate_own_case" on public.documents
  for all using (
    exists (
      select 1 from public.cases
      where cases.id = documents.case_id
        and cases.assigned_to = auth.uid()
    )
  );

-- DEADLINES: same pattern
create policy "deadlines_partner_all" on public.deadlines
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'partner')
  );

create policy "deadlines_associate_own_case" on public.deadlines
  for all using (
    exists (
      select 1 from public.cases
      where cases.id = deadlines.case_id
        and cases.assigned_to = auth.uid()
    )
  );

-- ============================================================
-- STORAGE BUCKET for case documents
-- Run this separately in Supabase > Storage > New Bucket
-- Name: "case-documents", Public: false
-- ============================================================

-- Storage policy (run in SQL editor)
insert into storage.buckets (id, name, public) values ('case-documents', 'case-documents', false)
on conflict do nothing;

create policy "storage_partner_all" on storage.objects
  for all using (
    bucket_id = 'case-documents' and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'partner')
  );

create policy "storage_associate_upload" on storage.objects
  for insert with check (
    bucket_id = 'case-documents' and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'associate')
  );

create policy "storage_associate_read" on storage.objects
  for select using (
    bucket_id = 'case-documents' and
    exists (select 1 from public.profiles where id = auth.uid())
  );

-- ============================================================
-- AUTO-UPDATE updated_at on cases
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger cases_updated_at
  before update on public.cases
  for each row execute function update_updated_at();

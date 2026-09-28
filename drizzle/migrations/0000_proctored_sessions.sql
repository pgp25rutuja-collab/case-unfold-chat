create type public.app_role as enum ('instructor', 'student');

create table public.profiles (
  id uuid primary key,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(), 'instructor'));
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'instructor'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  if not exists (select 1 from public.user_roles where role = 'instructor') then
    insert into public.user_roles (user_id, role) values (new.id, 'instructor');
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.promote_to_instructor(_email text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare uid uuid;
begin
  if not public.has_role(auth.uid(), 'instructor') then raise exception 'Not allowed'; end if;
  select id into uid from public.profiles where lower(email) = lower(_email);
  if uid is null then return false; end if;
  insert into public.user_roles (user_id, role) values (uid, 'instructor') on conflict do nothing;
  return true;
end $$;
revoke execute on function public.promote_to_instructor(text) from public, anon;
grant execute on function public.promote_to_instructor(text) to authenticated;

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null default auth.uid(),
  case_name text not null,
  case_text text not null,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  recording_path text,
  flag_count int not null default 0
);
grant select, insert, update on public.sessions to authenticated;
grant all on public.sessions to service_role;
alter table public.sessions enable row level security;
create policy "student own sessions read" on public.sessions for select to authenticated using (student_id = auth.uid() or public.has_role(auth.uid(), 'instructor'));
create policy "student own sessions insert" on public.sessions for insert to authenticated with check (student_id = auth.uid());
create policy "student own sessions update" on public.sessions for update to authenticated using (student_id = auth.uid());

create table public.session_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  idx int not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.session_turns to authenticated;
grant all on public.session_turns to service_role;
alter table public.session_turns enable row level security;
create policy "turns read" on public.session_turns for select to authenticated using (exists (select 1 from public.sessions s where s.id = session_id and (s.student_id = auth.uid() or public.has_role(auth.uid(), 'instructor'))));
create policy "turns insert" on public.session_turns for insert to authenticated with check (exists (select 1 from public.sessions s where s.id = session_id and s.student_id = auth.uid()));

create table public.session_flags (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  type text not null,
  detail text,
  at timestamptz not null default now(),
  offset_seconds int
);
grant select, insert on public.session_flags to authenticated;
grant all on public.session_flags to service_role;
alter table public.session_flags enable row level security;
create policy "flags read" on public.session_flags for select to authenticated using (exists (select 1 from public.sessions s where s.id = session_id and (s.student_id = auth.uid() or public.has_role(auth.uid(), 'instructor'))));
create policy "flags insert" on public.session_flags for insert to authenticated with check (exists (select 1 from public.sessions s where s.id = session_id and s.student_id = auth.uid()));

create policy "upload own recordings" on storage.objects for insert to authenticated with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own or instructor recordings" on storage.objects for select to authenticated using (bucket_id = 'recordings' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(), 'instructor')));
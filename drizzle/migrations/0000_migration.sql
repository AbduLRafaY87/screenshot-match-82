create type public.app_role as enum ('admin','teacher','student');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  roll_no text unique,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own role or admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.courses to authenticated;
grant all on public.courses to service_role;
alter table public.courses enable row level security;

create table public.course_teachers (
  course_id uuid references public.courses(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, teacher_id)
);
grant select, insert, delete on public.course_teachers to authenticated;
grant all on public.course_teachers to service_role;
alter table public.course_teachers enable row level security;

create table public.enrollments (
  course_id uuid references public.courses(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (course_id, student_id)
);
grant select, insert, delete on public.enrollments to authenticated;
grant all on public.enrollments to service_role;
alter table public.enrollments enable row level security;

create or replace function public.is_course_member(_user uuid, _course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.course_teachers where course_id=_course and teacher_id=_user)
      or exists(select 1 from public.enrollments where course_id=_course and student_id=_user)
$$;

create or replace function public.teaches(_user uuid, _course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.course_teachers where course_id=_course and teacher_id=_user)
$$;

-- profiles policies
create policy "read own or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin')
    or exists (select 1 from public.course_teachers ct join public.enrollments e on e.course_id=ct.course_id
               where (ct.teacher_id=auth.uid() and e.student_id=profiles.id)
                  or (e.student_id=auth.uid() and ct.teacher_id=profiles.id)));
create policy "admin update" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- courses
create policy "members or admin read courses" on public.courses for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.is_course_member(auth.uid(), id));
create policy "admin write courses" on public.courses for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "read course_teachers" on public.course_teachers for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.is_course_member(auth.uid(), course_id));
create policy "admin write course_teachers" on public.course_teachers for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "read enrollments" on public.enrollments for select to authenticated
  using (public.has_role(auth.uid(),'admin') or student_id = auth.uid() or public.teaches(auth.uid(), course_id));
create policy "admin write enrollments" on public.enrollments for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- announcements
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.announcements to authenticated;
grant all on public.announcements to service_role;
alter table public.announcements enable row level security;
create policy "read announcements" on public.announcements for select to authenticated
  using (course_id is null or public.has_role(auth.uid(),'admin') or public.is_course_member(auth.uid(), course_id));
create policy "post announcements" on public.announcements for insert to authenticated
  with check (author_id = auth.uid() and (public.has_role(auth.uid(),'admin')
    or (course_id is not null and public.teaches(auth.uid(), course_id))));
create policy "manage own announcements" on public.announcements for delete to authenticated
  using (author_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- audit
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "admin read audit" on public.audit_log for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- updated_at
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at = now(); return new; end $$;
create trigger t_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger t_courses before update on public.courses for each row execute function public.touch_updated_at();
create trigger t_ann before update on public.announcements for each row execute function public.touch_updated_at();

-- let a user clear their own must_change_password flag
create or replace function public.mark_password_changed() returns void language sql security definer set search_path=public as $$
  update public.profiles set must_change_password=false where id = auth.uid();
$$;
grant execute on function public.mark_password_changed() to authenticated;
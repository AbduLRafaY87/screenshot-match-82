create type public.question_type as enum ('mcq_single','mcq_multi','true_false');
create type public.complaint_status as enum ('open','in_review','resolved','rejected');

-- RESOURCES
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  title text not null, description text,
  file_path text not null, file_name text not null, mime_type text not null, size_bytes bigint not null,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.resources to authenticated;
grant all on public.resources to service_role;
alter table public.resources enable row level security;
create policy "members read resources" on public.resources for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.is_course_member(auth.uid(), course_id));
create policy "teachers add resources" on public.resources for insert to authenticated
  with check (uploaded_by = auth.uid() and (public.teaches(auth.uid(), course_id) or public.has_role(auth.uid(),'admin')));
create policy "teachers delete resources" on public.resources for delete to authenticated
  using (public.teaches(auth.uid(), course_id) or public.has_role(auth.uid(),'admin'));

-- ASSIGNMENTS
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null, instructions text not null,
  max_marks numeric(6,2) not null check (max_marks > 0),
  due_at timestamptz not null,
  allow_late boolean not null default false,
  attachment_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.assignments to authenticated;
grant all on public.assignments to service_role;
alter table public.assignments enable row level security;
create policy "members read assignments" on public.assignments for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.is_course_member(auth.uid(), course_id));
create policy "teachers manage assignments" on public.assignments for all to authenticated
  using (public.teaches(auth.uid(), course_id) or public.has_role(auth.uid(),'admin'))
  with check (public.teaches(auth.uid(), course_id) or public.has_role(auth.uid(),'admin'));
create trigger t_assign before update on public.assignments for each row execute function public.touch_updated_at();

create or replace function public.assignment_course(_a uuid) returns uuid language sql stable security definer set search_path=public as $$
  select course_id from public.assignments where id=_a $$;

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  text_answer text, file_path text,
  submitted_at timestamptz not null default now(),
  is_late boolean not null default false,
  marks_obtained numeric(6,2), feedback text,
  graded_by uuid references public.profiles(id) on delete set null, graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);
grant select, insert, update on public.submissions to authenticated;
grant all on public.submissions to service_role;
alter table public.submissions enable row level security;
create policy "read submissions" on public.submissions for select to authenticated
  using (student_id = auth.uid() or public.has_role(auth.uid(),'admin') or public.teaches(auth.uid(), public.assignment_course(assignment_id)));
create policy "student submits" on public.submissions for insert to authenticated
  with check (student_id = auth.uid() and public.is_course_member(auth.uid(), public.assignment_course(assignment_id)));
create policy "student resubmits ungraded" on public.submissions for update to authenticated
  using (student_id = auth.uid() and marks_obtained is null) with check (student_id = auth.uid());
create policy "teacher grades" on public.submissions for update to authenticated
  using (public.teaches(auth.uid(), public.assignment_course(assignment_id)) or public.has_role(auth.uid(),'admin'))
  with check (public.teaches(auth.uid(), public.assignment_course(assignment_id)) or public.has_role(auth.uid(),'admin'));

create or replace function public.submission_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare a record; is_teacher boolean;
begin
  select * into a from public.assignments where id = new.assignment_id;
  is_teacher := public.teaches(auth.uid(), a.course_id) or public.has_role(auth.uid(),'admin');
  if tg_op = 'UPDATE' and is_teacher and new.student_id <> auth.uid() then
    if new.marks_obtained is not null and (new.marks_obtained < 0 or new.marks_obtained > a.max_marks) then
      raise exception 'Marks must be between 0 and %', a.max_marks;
    end if;
    new.graded_by := auth.uid(); new.graded_at := now(); new.updated_at := now();
    new.text_answer := old.text_answer; new.file_path := old.file_path;
    new.submitted_at := old.submitted_at; new.is_late := old.is_late;
    return new;
  end if;
  if now() > a.due_at and not a.allow_late then raise exception 'The deadline has passed'; end if;
  new.is_late := now() > a.due_at;
  new.submitted_at := now(); new.updated_at := now();
  new.marks_obtained := null; new.feedback := null; new.graded_by := null; new.graded_at := null;
  return new;
end $$;
create trigger t_sub_guard before insert or update on public.submissions for each row execute function public.submission_guard();

-- QUIZZES
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null, description text,
  time_limit_minutes int not null check (time_limit_minutes > 0),
  opens_at timestamptz not null, closes_at timestamptz not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at > opens_at)
);
grant select, insert, update, delete on public.quizzes to authenticated;
grant all on public.quizzes to service_role;
alter table public.quizzes enable row level security;
create policy "read quizzes" on public.quizzes for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.teaches(auth.uid(), course_id)
    or (is_published and public.is_course_member(auth.uid(), course_id)));
create policy "teachers manage quizzes" on public.quizzes for all to authenticated
  using (public.teaches(auth.uid(), course_id) or public.has_role(auth.uid(),'admin'))
  with check (public.teaches(auth.uid(), course_id) or public.has_role(auth.uid(),'admin'));
create trigger t_quiz before update on public.quizzes for each row execute function public.touch_updated_at();

create or replace function public.quiz_course(_q uuid) returns uuid language sql stable security definer set search_path=public as $$
  select course_id from public.quizzes where id=_q $$;

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  answers jsonb not null default '{}',
  score numeric(6,2),
  created_at timestamptz not null default now(),
  unique (quiz_id, student_id)
);
grant select on public.quiz_attempts to authenticated;
grant all on public.quiz_attempts to service_role;
alter table public.quiz_attempts enable row level security;
create policy "read attempts" on public.quiz_attempts for select to authenticated
  using (student_id = auth.uid() or public.has_role(auth.uid(),'admin') or public.teaches(auth.uid(), public.quiz_course(quiz_id)));

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position int not null,
  type public.question_type not null,
  prompt text not null,
  options jsonb not null,
  marks numeric(5,2) not null default 1 check (marks > 0),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quiz_questions to authenticated;
grant all on public.quiz_questions to service_role;
alter table public.quiz_questions enable row level security;
create policy "read questions" on public.quiz_questions for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.teaches(auth.uid(), public.quiz_course(quiz_id))
    or exists (select 1 from public.quiz_attempts t where t.quiz_id = quiz_questions.quiz_id and t.student_id = auth.uid()));
create policy "teachers manage questions" on public.quiz_questions for all to authenticated
  using (public.teaches(auth.uid(), public.quiz_course(quiz_id)) or public.has_role(auth.uid(),'admin'))
  with check (public.teaches(auth.uid(), public.quiz_course(quiz_id)) or public.has_role(auth.uid(),'admin'));

create table public.quiz_answers (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_option_ids text[] not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quiz_answers to authenticated;
grant all on public.quiz_answers to service_role;
alter table public.quiz_answers enable row level security;
create policy "teachers only answers" on public.quiz_answers for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.teaches(auth.uid(), public.quiz_course((select quiz_id from public.quiz_questions q where q.id = question_id))))
  with check (public.has_role(auth.uid(),'admin') or public.teaches(auth.uid(), public.quiz_course((select quiz_id from public.quiz_questions q where q.id = question_id))));

create or replace function public.start_quiz(_quiz uuid) returns public.quiz_attempts
language plpgsql security definer set search_path=public as $$
declare q record; att public.quiz_attempts;
begin
  select * into q from public.quizzes where id=_quiz;
  if q is null or not q.is_published then raise exception 'Quiz not available'; end if;
  if not exists (select 1 from public.enrollments where course_id=q.course_id and student_id=auth.uid()) then raise exception 'Not enrolled'; end if;
  select * into att from public.quiz_attempts where quiz_id=_quiz and student_id=auth.uid();
  if att.id is not null then return att; end if;
  if now() < q.opens_at then raise exception 'Quiz has not opened yet'; end if;
  if now() > q.closes_at then raise exception 'Quiz is closed'; end if;
  insert into public.quiz_attempts(quiz_id, student_id) values (_quiz, auth.uid()) returning * into att;
  return att;
end $$;
grant execute on function public.start_quiz(uuid) to authenticated;

create or replace function public.submit_quiz(_quiz uuid, _answers jsonb) returns numeric
language plpgsql security definer set search_path=public as $$
declare att public.quiz_attempts; q record; total numeric := 0; r record; given text[]; deadline timestamptz;
begin
  select * into att from public.quiz_attempts where quiz_id=_quiz and student_id=auth.uid();
  if att.id is null then raise exception 'No attempt started'; end if;
  if att.submitted_at is not null then return att.score; end if;
  select * into q from public.quizzes where id=_quiz;
  deadline := least(att.started_at + make_interval(mins => q.time_limit_minutes), q.closes_at) + interval '60 seconds';
  if now() > deadline then _answers := '{}'::jsonb; end if;
  for r in select qq.id, qq.marks, qa.correct_option_ids from public.quiz_questions qq
           join public.quiz_answers qa on qa.question_id = qq.id where qq.quiz_id=_quiz loop
    select coalesce(array_agg(x order by x), '{}') into given from jsonb_array_elements_text(coalesce(_answers -> r.id::text, '[]'::jsonb)) x;
    if given = (select coalesce(array_agg(y order by y), '{}') from unnest(r.correct_option_ids) y) then total := total + r.marks; end if;
  end loop;
  update public.quiz_attempts set submitted_at=now(), answers=_answers, score=total where id=att.id;
  return total;
end $$;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

-- GRADEBOOK VIEW (respects RLS of underlying tables)
create or replace view public.v_student_marks with (security_invoker = true) as
select s.student_id, a.course_id, 'assignment'::text as kind, a.id as item_id, a.title,
  s.marks_obtained as obtained, a.max_marks as max, s.graded_at
from public.submissions s join public.assignments a on a.id = s.assignment_id
where s.marks_obtained is not null
union all
select t.student_id, qz.course_id, 'quiz'::text, qz.id, qz.title, t.score,
  (select coalesce(sum(marks),0) from public.quiz_questions where quiz_id = qz.id), t.submitted_at
from public.quiz_attempts t join public.quizzes qz on qz.id = t.quiz_id
where t.submitted_at is not null;
grant select on public.v_student_marks to authenticated;

-- CHAT
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
grant select, insert, update on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;
create policy "members read chat" on public.chat_messages for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.is_course_member(auth.uid(), course_id));
create policy "members send chat" on public.chat_messages for insert to authenticated
  with check (sender_id = auth.uid() and (public.is_course_member(auth.uid(), course_id) or public.has_role(auth.uid(),'admin')));
create policy "moderate chat" on public.chat_messages for update to authenticated
  using (sender_id = auth.uid() or public.teaches(auth.uid(), course_id) or public.has_role(auth.uid(),'admin'))
  with check (sender_id = auth.uid() or public.teaches(auth.uid(), course_id) or public.has_role(auth.uid(),'admin'));
alter publication supabase_realtime add table public.chat_messages;

-- COMPLAINTS
create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  raised_by uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  category text not null check (category in ('academic','technical','facility','conduct','other')),
  subject text not null, description text not null,
  attachment_path text,
  status public.complaint_status not null default 'open',
  admin_response text,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.complaints to authenticated;
grant all on public.complaints to service_role;
alter table public.complaints enable row level security;
create policy "read complaints" on public.complaints for select to authenticated
  using (raised_by = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "file complaint" on public.complaints for insert to authenticated
  with check (raised_by = auth.uid() and status = 'open' and admin_response is null);
create policy "admin handles complaints" on public.complaints for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger t_compl before update on public.complaints for each row execute function public.touch_updated_at();

-- STORAGE POLICIES (bucket 'lms')
create policy "lms read" on storage.objects for select to authenticated using (
  bucket_id = 'lms' and (
    public.has_role(auth.uid(),'admin')
    or ((storage.foldername(name))[1] = 'courses' and (storage.foldername(name))[3] in ('resources','assignments')
        and public.is_course_member(auth.uid(), ((storage.foldername(name))[2])::uuid))
    or ((storage.foldername(name))[1] = 'courses' and (storage.foldername(name))[3] = 'submissions'
        and ((storage.foldername(name))[4] = auth.uid()::text or public.teaches(auth.uid(), ((storage.foldername(name))[2])::uuid)))
    or ((storage.foldername(name))[1] = 'complaints' and (storage.foldername(name))[2] = auth.uid()::text)
  ));
create policy "lms write" on storage.objects for insert to authenticated with check (
  bucket_id = 'lms' and (
    ((storage.foldername(name))[1] = 'courses' and (storage.foldername(name))[3] in ('resources','assignments')
        and (public.teaches(auth.uid(), ((storage.foldername(name))[2])::uuid) or public.has_role(auth.uid(),'admin')))
    or ((storage.foldername(name))[1] = 'courses' and (storage.foldername(name))[3] = 'submissions'
        and (storage.foldername(name))[4] = auth.uid()::text
        and public.is_course_member(auth.uid(), ((storage.foldername(name))[2])::uuid))
    or ((storage.foldername(name))[1] = 'complaints' and (storage.foldername(name))[2] = auth.uid()::text)
  ));
create policy "lms delete" on storage.objects for delete to authenticated using (
  bucket_id = 'lms' and (
    public.has_role(auth.uid(),'admin')
    or ((storage.foldername(name))[1] = 'courses' and (storage.foldername(name))[3] in ('resources','assignments')
        and public.teaches(auth.uid(), ((storage.foldername(name))[2])::uuid))
  ));
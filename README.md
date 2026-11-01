# GU Tech LMS

A learning management system for students, teachers, and administrators. This project was built with [Lovable](https://lovable.dev) and uses Supabase for authentication, PostgreSQL, and file storage.

## Requirements

- Node.js and npm
- A Supabase project

## Local development

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
npm run dev
```

Create a `.env` file in the project root with credentials from **Supabase → Project Settings → API Keys**:

```env
SUPABASE_PROJECT_ID=your-project-ref
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-secret-key

VITE_SUPABASE_PROJECT_ID=your-project-ref
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Use the publishable key for `SUPABASE_PUBLISHABLE_KEY` and its `VITE_` counterpart. Use the project's secret API key (or legacy `service_role` key) for `SUPABASE_SERVICE_ROLE_KEY`. All values must belong to the same Supabase project. The project ID variables are included for tooling compatibility; the application connects using the URL and keys.

`SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security. Keep it server-only: never prefix it with `VITE_`, expose it in browser code, commit it, or share it. Restart the dev server after changing `.env`. Set the same server-side variables in your hosting provider for deployment.

## Initialize the Supabase database

For a new Supabase project, open **Supabase → SQL Editor** and run the project's SQL migrations in order:

1. `drizzle/migrations/0000_migration.sql`
2. `drizzle/migrations/0001_migration.sql`

Run each migration once, in full. The second migration depends on the tables and functions created by the first. Do not use `schema.sql` as a migration; it is a schema reference, not an executable migration. The migrations create the app's tables, row-level security policies, and gradebook view.

## Create the first administrator

Public signup is disabled. To bootstrap the first admin, first create your own account in **Supabase → Authentication → Users**. Then run this in the SQL Editor, replacing the email and name with your account details:

```sql
do $$
declare
  target_email text := 'you@example.com';
  target_name text := 'Your Name';
  target_user_id uuid;
begin
  select id into target_user_id
  from auth.users
  where lower(email) = lower(target_email);

  if target_user_id is null then
    raise exception 'No auth user found for that email';
  end if;

  insert into public.profiles (id, full_name, email)
  select target_user_id, target_name, email
  from auth.users
  where id = target_user_id
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (target_user_id, 'admin'::public.app_role)
  on conflict (user_id, role) do nothing;
end $$;
```

Sign out and back in to refresh the app's role. Roles belong in `public.user_roles` and are checked with `has_role()`; do not store authorization roles in `profiles`. After the first admin is set up, create and manage users from the app's **Users** page.

## Troubleshooting

- **“Unregistered API key”**: verify that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` both belong to the same project and that the server key is a secret/service-role key, not the publishable key.
- **Foreign key error referencing `profiles`**: make sure the signed-in Auth user has a matching row in `public.profiles`. The first-admin SQL above creates the profile if it is missing.
- **“Could not find table/view in the schema cache”**: check that both migrations have run successfully in order. Then refresh the app; if the view was just created and the error persists, reload the Supabase schema cache or wait briefly and retry.
- **Ambiguous relationship between `submissions` and `profiles`**: the student and grader IDs both reference profiles. Queries embedding a submission's student profile must specify `profiles!submissions_student_id_fkey(...)`.

## Project scripts

```sh
npm run dev
npm run build
npm run lint
npm test
```

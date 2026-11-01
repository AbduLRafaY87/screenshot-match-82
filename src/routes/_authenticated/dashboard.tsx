import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Users, Megaphone, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { Loading, ErrorState, Empty } from "@/components/States";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — GU Tech LMS" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useMe();
  const stats = useQuery({
    queryKey: ["stats", me?.role],
    queryFn: async () => {
      const [c, a] = await Promise.all([
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("announcements").select("id,title,body,created_at,course_id,courses(code)").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(5),
      ]);
      let users = 0;
      if (me?.role === "admin") {
        const u = await supabase.from("profiles").select("id", { count: "exact", head: true });
        users = u.count ?? 0;
      }
      if (a.error) throw a.error;
      return { courses: c.count ?? 0, users, announcements: a.data };
    },
    enabled: !!me,
  });

  if (!me) return <Loading />;
  return (
    <div>
      <div className="mb-8 overflow-hidden rounded-xl bg-hero p-8 text-primary-foreground shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Welcome back</p>
        <h1 className="mt-2 text-3xl font-extrabold">{me.profile?.full_name}</h1>
        <p className="mt-1 text-sm capitalize text-primary-foreground/70">{me.role} · Ghazali University School of Technology</p>
      </div>
      {stats.isLoading ? <Loading /> : stats.error ? <ErrorState error={stats.error} /> : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <Stat icon={BookOpen} label={me.role === "admin" ? "Courses" : me.role === "teacher" ? "My classes" : "My courses"} value={stats.data!.courses} to="/courses" />
            {me.role === "admin" && <Stat icon={Users} label="Users" value={stats.data!.users} to="/users" />}
            <Stat icon={Megaphone} label="Recent announcements" value={stats.data!.announcements.length} to="/announcements" />
          </div>
          <h2 className="mb-3 text-lg font-bold">Latest announcements</h2>
          {stats.data!.announcements.length === 0 ? <Empty title="No announcements yet" /> : (
            <div className="space-y-3">
              {stats.data!.announcements.map((a: any) => (
                <div key={a.id} className="rounded-lg border bg-card p-4 shadow-card">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground">{a.courses?.code ?? "GU Tech"}</span>
                    {new Date(a.created_at).toLocaleDateString()}
                  </div>
                  <p className="mt-1 font-semibold">{a.title}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{a.body}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, to }: { icon: typeof GraduationCap; label: string; value: number; to: "/courses" | "/users" | "/announcements" }) {
  return (
    <Link to={to} className="group rounded-lg border bg-card p-5 shadow-card transition-colors hover:border-primary">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-3 text-3xl font-extrabold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </Link>
  );
}

import { createFileRoute, Outlet, redirect, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Users, BookOpen, Megaphone, LogOut, KeyRound, BarChart3, MessageSquareWarning } from "lucide-react";
import logo from "@/assets/images.png";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, useMe } from "@/lib/me";
import { Loading } from "@/components/States";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.profile?.must_change_password && location.pathname !== "/change-password") {
      throw redirect({ to: "/change-password" });
    }
  },
  component: Shell,
});

function Shell() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const loc = useLocation();
  if (!me) return <Loading />;
  const role = me.role;
  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/courses", label: role === "admin" ? "Courses" : role === "teacher" ? "My Classes" : "My Courses", icon: BookOpen, show: true },
    { to: "/users", label: "Users", icon: Users, show: role === "admin" },
    { to: "/grades", label: role === "student" ? "My Grades" : "Gradebook", icon: BarChart3, show: true },
    { to: "/announcements", label: "Announcements", icon: Megaphone, show: true },
    { to: "/complaints", label: "Complaints", icon: MessageSquareWarning, show: true },
    { to: "/change-password", label: "Password", icon: KeyRound, show: true },
  ] as const;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border">
          <img src={logo} alt="GU Tech — Ghazali University School of Technology" className="h-28 w-full object-cover" />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.filter((n) => n.show).map((n) => {
            const active = loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"}`}
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <p className="truncate text-sm font-semibold">{me.profile?.full_name}</p>
          <p className="mb-3 text-xs capitalize text-gold">{role}</p>
          <button onClick={signOut} className="flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <img src={logo.url} alt="GU Tech" className="h-10 rounded object-cover" />
          <div className="flex gap-3 text-xs">
            {nav.filter((n) => n.show).map((n) => (
              <Link key={n.to} to={n.to} className="text-muted-foreground [&.active]:text-primary">{n.label}</Link>
            ))}
            <button onClick={signOut}>Sign out</button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

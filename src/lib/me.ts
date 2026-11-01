import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "teacher" | "student";

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    ]);
    const list = (roles ?? []).map((r) => r.role as Role);
    const role: Role = list.includes("admin") ? "admin" : list.includes("teacher") ? "teacher" : "student";
    return { user: u.user, profile, role };
  },
});

export function useMe() {
  return useQuery(meQuery);
}

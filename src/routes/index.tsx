import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "GU Tech LMS — Ghazali University School of Technology" },
      { name: "description", content: "Internal learning management system for GU Tech students, teachers and administrators." },
      { property: "og:title", content: "GU Tech LMS" },
      { property: "og:description", content: "Internal learning management system for Ghazali University School of Technology." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/dashboard" : "/auth" });
  },
});

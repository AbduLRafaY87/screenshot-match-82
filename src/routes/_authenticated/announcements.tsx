import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pin, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loading, Empty, ErrorState, PageHeader } from "@/components/States";

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({ meta: [{ title: "Announcements — GU Tech LMS" }] }),
  component: Page,
});

const schema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(3).max(5000),
  course_id: z.string(),
  is_pinned: z.boolean().default(false),
});

function Page() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const canPost = me?.role === "admin" || me?.role === "teacher";

  const list = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("announcements").select("*, courses(code), profiles(full_name)").order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const courses = useQuery({
    queryKey: ["my-teach-courses", me?.user.id],
    enabled: canPost,
    queryFn: async () => {
      if (me!.role === "admin") return (await supabase.from("courses").select("id, code")).data ?? [];
      return ((await supabase.from("course_teachers").select("courses(id, code)").eq("teacher_id", me!.user.id)).data ?? []).map((r: any) => r.courses);
    },
  });

  const form = useForm<z.input<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { course_id: me?.role === "admin" ? "global" : "", is_pinned: false } });
  const onSubmit = form.handleSubmit(async (v) => {
    if (!v.course_id) { toast.error("Choose a course"); return; }
    const { error } = await supabase.from("announcements").insert({
      title: v.title, body: v.body, is_pinned: !!v.is_pinned,
      course_id: v.course_id === "global" ? null : v.course_id, author_id: me!.user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Posted");
    form.reset({ course_id: v.course_id, title: "", body: "", is_pinned: false });
    qc.invalidateQueries({ queryKey: ["announcements"] });
  });

  return (
    <div>
      <PageHeader title="Announcements" />
      {canPost && (
        <form onSubmit={onSubmit} className="mb-8 space-y-3 rounded-lg border bg-card p-5 shadow-card">
          <div className="flex flex-wrap gap-3">
            <Select value={form.watch("course_id")} onValueChange={(v) => form.setValue("course_id", v)}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Audience" /></SelectTrigger>
              <SelectContent>
                {me?.role === "admin" && <SelectItem value="global">All of GU Tech</SelectItem>}
                {(courses.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("is_pinned")} /> Pin</label>
          </div>
          <Input placeholder="Title" {...form.register("title")} />
          <Textarea placeholder="Write your announcement…" {...form.register("body")} />
          {(form.formState.errors.title || form.formState.errors.body) && <p className="text-xs text-destructive">Title and message need at least 3 characters.</p>}
          <Button type="submit" disabled={form.formState.isSubmitting}>Post announcement</Button>
        </form>
      )}
      {list.isLoading ? <Loading /> : list.error ? <ErrorState error={list.error} /> : list.data!.length === 0 ? <Empty title="No announcements" /> : (
        <div className="space-y-3">
          {list.data!.map((a: any) => (
            <article key={a.id} className={`rounded-lg border bg-card p-5 shadow-card ${a.is_pinned ? "border-gold" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {a.is_pinned && <Pin className="h-3.5 w-3.5 text-gold" />}
                  <span className="rounded bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground">{a.courses?.code ?? "GU Tech"}</span>
                  {a.profiles?.full_name} · {new Date(a.created_at).toLocaleString()}
                </div>
                {(a.author_id === me?.user.id || me?.role === "admin") && (
                  <Button size="icon" variant="ghost" onClick={async () => { await supabase.from("announcements").delete().eq("id", a.id); qc.invalidateQueries({ queryKey: ["announcements"] }); }}><Trash2 className="h-4 w-4" /></Button>
                )}
              </div>
              <h3 className="mt-2 font-bold">{a.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

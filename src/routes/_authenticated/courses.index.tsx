import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loading, Empty, ErrorState, PageHeader } from "@/components/States";

export const Route = createFileRoute("/_authenticated/courses/")({
  head: () => ({ meta: [{ title: "Courses — GU Tech LMS" }] }),
  component: CoursesPage,
});

const schema = z.object({
  code: z.string().trim().min(2).max(20).regex(/^[A-Z0-9-]+$/, "Uppercase letters/numbers, e.g. CS101"),
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(2000).optional(),
});

function CoursesPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*, enrollments(count), course_teachers(count)").order("code");
      if (error) throw error;
      return data;
    },
  });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const onSubmit = form.handleSubmit(async (v) => {
    const { error } = await supabase.from("courses").insert({ ...v, description: v.description ?? null });
    if (error) { toast.error(error.message); return; }
    toast.success("Course created");
    form.reset();
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["courses"] });
  });

  const isAdmin = me?.role === "admin";
  const title = isAdmin ? "Courses" : me?.role === "teacher" ? "My Classes" : "My Courses";
  return (
    <div>
      <PageHeader
        title={title}
        action={isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New course</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create course</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-1"><Label>Code</Label><Input placeholder="CS101" {...form.register("code")} />{form.formState.errors.code && <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>}</div>
                <div className="space-y-1"><Label>Title</Label><Input {...form.register("title")} />{form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}</div>
                <div className="space-y-1"><Label>Description</Label><Textarea {...form.register("description")} /></div>
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>Create</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      />
      {courses.isLoading ? <Loading /> : courses.error ? <ErrorState error={courses.error} /> : courses.data!.length === 0 ? (
        <Empty title="No courses yet" hint={isAdmin ? "Create your first course." : "You haven't been assigned to any course."} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.data!.map((c: any) => (
            <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }} className="group overflow-hidden rounded-lg border bg-card shadow-card transition-colors hover:border-primary">
              <div className="h-2 bg-hero" />
              <div className="p-5">
                <span className="rounded bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">{c.code}</span>
                <p className="mt-2 font-bold group-hover:text-primary">{c.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description || "No description"}</p>
                <p className="mt-3 text-xs text-muted-foreground">{c.enrollments?.[0]?.count ?? 0} students · {c.course_teachers?.[0]?.count ?? 0} teachers</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loading, Empty, ErrorState } from "@/components/States";

const schema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).optional(),
    time_limit_minutes: z.coerce.number().int().min(1).max(600),
    opens_at: z.string().min(1),
    closes_at: z.string().min(1),
  })
  .refine((v) => new Date(v.closes_at) > new Date(v.opens_at), { path: ["closes_at"], message: "Must close after it opens" });

export function quizStatus(q: { opens_at: string; closes_at: string }) {
  const now = new Date();
  if (now < new Date(q.opens_at)) return "upcoming";
  if (now > new Date(q.closes_at)) return "closed";
  return "open";
}

export function QuizzesTab({ courseId, canManage, userId }: { courseId: string; canManage: boolean; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["quizzes", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("*, quiz_attempts(student_id, score, submitted_at), quiz_questions(count)").eq("course_id", courseId).order("opens_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { time_limit_minutes: 20 } });
  const onSubmit = form.handleSubmit(async (v) => {
    const { error } = await supabase.from("quizzes").insert({
      title: v.title, description: v.description || null, time_limit_minutes: v.time_limit_minutes,
      opens_at: new Date(v.opens_at).toISOString(), closes_at: new Date(v.closes_at).toISOString(),
      course_id: courseId, created_by: userId,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Quiz created — now add questions"); setOpen(false); form.reset();
    qc.invalidateQueries({ queryKey: ["quizzes", courseId] });
  });

  return (
    <div className="space-y-4">
      {canManage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New quiz</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create quiz</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1"><Label>Title</Label><Input {...form.register("title")} /></div>
              <div className="space-y-1"><Label>Description</Label><Textarea {...form.register("description")} /></div>
              <div className="space-y-1"><Label>Time limit (minutes)</Label><Input type="number" {...form.register("time_limit_minutes")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Opens</Label><Input type="datetime-local" {...form.register("opens_at")} /></div>
                <div className="space-y-1"><Label>Closes</Label><Input type="datetime-local" {...form.register("closes_at")} /></div>
              </div>
              {form.formState.errors.closes_at && <p className="text-xs text-destructive">{form.formState.errors.closes_at.message}</p>}
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} /> : q.data!.length === 0 ? <Empty title="No quizzes yet" /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {q.data!.map((z: any) => {
            const st = quizStatus(z);
            const mine = z.quiz_attempts.find((a: any) => a.student_id === userId);
            return (
              <Link key={z.id} to="/quiz/$quizId" params={{ quizId: z.id }} className="rounded-lg border bg-card p-5 shadow-card transition-colors hover:border-primary">
                <div className="flex items-center gap-2">
                  <Badge variant={st === "open" ? "default" : "secondary"} className="capitalize">{st}</Badge>
                  {canManage && !z.is_published && <Badge variant="outline">Draft</Badge>}
                </div>
                <p className="mt-2 font-bold">{z.title}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Timer className="h-3 w-3" /> {z.time_limit_minutes} min · {z.quiz_questions?.[0]?.count ?? 0} questions</p>
                <p className="text-xs text-muted-foreground">{new Date(z.opens_at).toLocaleString()} → {new Date(z.closes_at).toLocaleString()}</p>
                {canManage ? <p className="mt-2 text-xs">{z.quiz_attempts.filter((a: any) => a.submitted_at).length} submitted</p>
                  : mine?.submitted_at ? <p className="mt-2 text-sm font-semibold text-primary">Score: {Number(mine.score)}</p> : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Paperclip, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile, openFile, fileLabel, ALLOWED } from "@/lib/files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loading, Empty, ErrorState } from "@/components/States";

const schema = z.object({
  title: z.string().trim().min(3).max(200),
  instructions: z.string().trim().min(3).max(10000),
  max_marks: z.coerce.number().positive().max(1000),
  due_at: z.string().min(1, "Due date required"),
  allow_late: z.boolean(),
});

export function AssignmentsTab({ courseId, canManage, userId }: { courseId: string; canManage: boolean; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const q = useQuery({
    queryKey: ["assignments", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("assignments").select("*, submissions(*, profiles!submissions_student_id_fkey(full_name, roll_no))").eq("course_id", courseId).order("due_at");
      if (error) throw error;
      return data;
    },
  });
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { allow_late: false, max_marks: 10 } });
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const attachment_path = file ? await uploadFile(`courses/${courseId}/assignments`, file) : null;
      const { error } = await supabase.from("assignments").insert({ ...v, due_at: new Date(v.due_at).toISOString(), course_id: courseId, created_by: userId, attachment_path });
      if (error) throw error;
      toast.success("Assignment created"); setOpen(false); form.reset(); setFile(null);
      qc.invalidateQueries({ queryKey: ["assignments", courseId] });
    } catch (e: any) { toast.error(e.message); }
  });

  return (
    <div className="space-y-4">
      {canManage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New assignment</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create assignment</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1"><Label>Title</Label><Input {...form.register("title")} /></div>
              <div className="space-y-1"><Label>Instructions</Label><Textarea rows={5} {...form.register("instructions")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Max marks</Label><Input type="number" step="0.5" {...form.register("max_marks")} /></div>
                <div className="space-y-1"><Label>Due</Label><Input type="datetime-local" {...form.register("due_at")} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.watch("allow_late")} onCheckedChange={(c) => form.setValue("allow_late", c)} /><Label>Accept late submissions</Label></div>
              <div className="space-y-1"><Label>Attachment (optional)</Label><Input type="file" accept={ALLOWED} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
              {Object.keys(form.formState.errors).length > 0 && <p className="text-xs text-destructive">Please complete all fields correctly.</p>}
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} /> : q.data!.length === 0 ? <Empty title="No assignments yet" /> : (
        <div className="space-y-3">
          {q.data!.map((a: any) => canManage ? <TeacherCard key={a.id} a={a} courseId={courseId} /> : <StudentCard key={a.id} a={a} courseId={courseId} userId={userId} />)}
        </div>
      )}
    </div>
  );
}

function Header({ a }: { a: any }) {
  const overdue = new Date(a.due_at) < new Date();
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold">{a.title}</h3>
        <Badge variant="secondary">{Number(a.max_marks)} marks</Badge>
        <span className={`flex items-center gap-1 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}><Clock className="h-3 w-3" /> Due {new Date(a.due_at).toLocaleString()}</span>
        {a.allow_late && <Badge variant="outline">Late allowed</Badge>}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{a.instructions}</p>
      {a.attachment_path && <button className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline" onClick={() => openFile(a.attachment_path)}><Paperclip className="h-3 w-3" /> {fileLabel(a.attachment_path)}</button>}
    </div>
  );
}

function StudentCard({ a, courseId, userId }: { a: any; courseId: string; userId: string }) {
  const qc = useQueryClient();
  const mine = a.submissions.find((s: any) => s.student_id === userId);
  const [text, setText] = useState(mine?.text_answer ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const closed = new Date(a.due_at) < new Date() && !a.allow_late;
  const graded = mine?.marks_obtained != null;

  async function submit() {
    if (!text.trim() && !file && !mine?.file_path) { toast.error("Write an answer or attach a file"); return; }
    setBusy(true);
    try {
      const file_path = file ? await uploadFile(`courses/${courseId}/submissions/${userId}`, file) : mine?.file_path ?? null;
      const { error } = await supabase.from("submissions").upsert({ assignment_id: a.id, student_id: userId, text_answer: text.trim() || null, file_path }, { onConflict: "assignment_id,student_id" });
      if (error) throw error;
      toast.success("Submitted"); setFile(null);
      qc.invalidateQueries({ queryKey: ["assignments", courseId] });
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  }

  return (
    <div className="rounded-lg border bg-card p-5 shadow-card">
      <Header a={a} />
      <div className="mt-4 border-t pt-4">
        {graded ? (
          <div className="rounded-md bg-accent p-3">
            <p className="flex items-center gap-2 font-semibold text-accent-foreground"><CheckCircle2 className="h-4 w-4" /> {Number(mine.marks_obtained)} / {Number(a.max_marks)}</p>
            {mine.feedback && <p className="mt-1 text-sm">{mine.feedback}</p>}
          </div>
        ) : closed && !mine ? (
          <p className="text-sm text-destructive">Deadline passed — submissions closed.</p>
        ) : (
          <div className="space-y-2">
            {mine && <p className="text-xs text-muted-foreground">Submitted {new Date(mine.submitted_at).toLocaleString()}{mine.is_late ? " (late)" : ""} — you can resubmit until it's graded.</p>}
            {mine?.file_path && <button className="text-xs text-primary hover:underline" onClick={() => openFile(mine.file_path)}>{fileLabel(mine.file_path)}</button>}
            <Textarea placeholder="Your answer…" value={text} onChange={(e) => setText(e.target.value)} disabled={closed} />
            <div className="flex flex-wrap gap-2">
              <Input type="file" accept={ALLOWED} className="max-w-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={closed} />
              <Button onClick={submit} disabled={busy || closed}>{mine ? "Resubmit" : "Submit"}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TeacherCard({ a, courseId }: { a: any; courseId: string }) {
  const [show, setShow] = useState(false);
  const graded = a.submissions.filter((s: any) => s.marks_obtained != null).length;
  return (
    <div className="rounded-lg border bg-card p-5 shadow-card">
      <Header a={a} />
      <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm">
        <span className="text-muted-foreground">{a.submissions.length} submissions · {graded} graded</span>
        <Button size="sm" variant="outline" onClick={() => setShow(!show)}>{show ? "Hide" : "Grade submissions"}</Button>
      </div>
      {show && (
        <div className="mt-3 space-y-3">
          {a.submissions.length === 0 ? <Empty title="No submissions yet" /> : a.submissions.map((s: any) => <GradeRow key={s.id} s={s} max={Number(a.max_marks)} courseId={courseId} />)}
        </div>
      )}
    </div>
  );
}

function GradeRow({ s, max, courseId }: { s: any; max: number; courseId: string }) {
  const qc = useQueryClient();
  const [marks, setMarks] = useState<string>(s.marks_obtained?.toString() ?? "");
  const [feedback, setFeedback] = useState<string>(s.feedback ?? "");
  async function save() {
    const m = Number(marks);
    if (marks === "" || isNaN(m) || m < 0 || m > max) { toast.error(`Marks must be 0–${max}`); return; }
    const { error } = await supabase.from("submissions").update({ marks_obtained: m, feedback: feedback.trim() || null }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Graded");
    qc.invalidateQueries({ queryKey: ["assignments", courseId] });
  }
  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">{s.profiles?.full_name} <span className="font-mono text-xs text-muted-foreground">{s.profiles?.roll_no}</span></span>
        <span className="text-xs text-muted-foreground">{new Date(s.submitted_at).toLocaleString()} {s.is_late && <Badge variant="destructive">Late</Badge>}</span>
      </div>
      {s.text_answer && <p className="mt-2 whitespace-pre-wrap rounded bg-muted p-2 text-sm">{s.text_answer}</p>}
      {s.file_path && <button className="mt-2 text-xs text-primary hover:underline" onClick={() => openFile(s.file_path)}>{fileLabel(s.file_path)}</button>}
      <div className="mt-2 flex flex-wrap gap-2">
        <Input type="number" className="w-24" placeholder={`/${max}`} value={marks} onChange={(e) => setMarks(e.target.value)} />
        <Input className="flex-1" placeholder="Feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        <Button size="sm" onClick={save}>Save</Button>
      </div>
    </div>
  );
}

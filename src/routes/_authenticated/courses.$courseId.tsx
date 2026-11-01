import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { X, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { bulkCreateStudents } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loading, Empty, ErrorState, PageHeader } from "@/components/States";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  head: () => ({ meta: [{ title: "Course — GU Tech LMS" }] }),
  component: CoursePage,
});

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift()!.split(",").map((h) => h.trim().toLowerCase());
  return lines.filter(Boolean).map((l) => {
    const cells = l.split(",").map((c) => c.trim());
    const o: Record<string, string> = {};
    header.forEach((h, i) => (o[h] = cells[i] ?? ""));
    return { full_name: o.full_name || o.name, email: o.email, roll_no: o.roll_no || null, role: "student" as const };
  });
}

function CoursePage() {
  const { courseId } = Route.useParams();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const bulk = useServerFn(bulkCreateStudents);
  const [pick, setPick] = useState("");
  const [pickT, setPickT] = useState("");
  const [csvResult, setCsvResult] = useState<{ created: { email: string; password: string }[]; errors: string[] } | null>(null);
  const isAdmin = me?.role === "admin";

  const q = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, course_teachers(teacher_id, profiles(id, full_name, email)), enrollments(student_id, profiles(id, full_name, email, roll_no))")
        .eq("id", courseId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const people = useQuery({
    queryKey: ["people-roles"],
    enabled: isAdmin,
    queryFn: async () => {
      const [p, r] = await Promise.all([supabase.from("profiles").select("id, full_name, email").eq("is_active", true), supabase.from("user_roles").select("user_id, role")]);
      const roles = new Map((r.data ?? []).map((x) => [x.user_id, x.role]));
      return (p.data ?? []).map((u) => ({ ...u, role: roles.get(u.id) }));
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["course", courseId] });

  async function run(p: PromiseLike<{ error: any }>, ok: string) {
    const { error } = await p;
    if (error) toast.error(error.message); else { toast.success(ok); refresh(); }
  }

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  const c: any = q.data;
  const enrolledIds = new Set(c.enrollments.map((e: any) => e.student_id));
  const teacherIds = new Set(c.course_teachers.map((t: any) => t.teacher_id));

  return (
    <div>
      <PageHeader title={`${c.code} · ${c.title}`} subtitle={c.description ?? undefined} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-5 shadow-card">
          <h2 className="mb-3 font-bold">Teachers</h2>
          {isAdmin && (
            <div className="mb-3 flex gap-2">
              <Select value={pickT} onValueChange={setPickT}>
                <SelectTrigger><SelectValue placeholder="Assign a teacher" /></SelectTrigger>
                <SelectContent>{(people.data ?? []).filter((p) => p.role === "teacher" && !teacherIds.has(p.id)).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
              </Select>
              <Button disabled={!pickT} onClick={() => { run(supabase.from("course_teachers").insert({ course_id: courseId, teacher_id: pickT }), "Teacher assigned"); setPickT(""); }}>Assign</Button>
            </div>
          )}
          {c.course_teachers.length === 0 ? <Empty title="No teacher assigned" /> : (
            <ul className="divide-y">{c.course_teachers.map((t: any) => (
              <li key={t.teacher_id} className="flex items-center justify-between py-2 text-sm">
                <span>{t.profiles?.full_name} <span className="text-muted-foreground">· {t.profiles?.email}</span></span>
                {isAdmin && <Button size="icon" variant="ghost" onClick={() => run(supabase.from("course_teachers").delete().eq("course_id", courseId).eq("teacher_id", t.teacher_id), "Removed")}><X className="h-4 w-4" /></Button>}
              </li>
            ))}</ul>
          )}
        </section>

        <section className="rounded-lg border bg-card p-5 shadow-card">
          <h2 className="mb-3 font-bold">Students ({c.enrollments.length})</h2>
          {isAdmin && (
            <>
              <div className="mb-3 flex gap-2">
                <Select value={pick} onValueChange={setPick}>
                  <SelectTrigger><SelectValue placeholder="Enroll a student" /></SelectTrigger>
                  <SelectContent>{(people.data ?? []).filter((p) => p.role === "student" && !enrolledIds.has(p.id)).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                </Select>
                <Button disabled={!pick} onClick={() => { run(supabase.from("enrollments").insert({ course_id: courseId, student_id: pick }), "Student enrolled"); setPick(""); }}>Enroll</Button>
              </div>
              <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground hover:border-primary">
                <Upload className="h-4 w-4" /> Bulk import CSV (columns: full_name,email,roll_no) — creates accounts &amp; enrolls
                <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  try {
                    const rows = parseCsv(await f.text()).filter((r) => r.email && r.full_name);
                    if (!rows.length) return toast.error("No valid rows found");
                    const res = await bulk({ data: { courseId, rows } });
                    setCsvResult(res); refresh();
                    toast.success(`${res.created.length} created`);
                  } catch (err: any) { toast.error(err.message); }
                  e.target.value = "";
                }} />
              </label>
              {csvResult && (
                <div className="mb-3 rounded-md border border-gold bg-accent p-3 text-xs">
                  <p className="mb-1 font-semibold">Temporary passwords (copy now):</p>
                  {csvResult.created.map((x) => <p key={x.email} className="font-mono">{x.email} — {x.password}</p>)}
                  {csvResult.errors.map((x) => <p key={x} className="text-destructive">{x}</p>)}
                </div>
              )}
            </>
          )}
          {c.enrollments.length === 0 ? <Empty title="No students enrolled" /> : (
            <ul className="divide-y">{c.enrollments.map((e: any) => (
              <li key={e.student_id} className="flex items-center justify-between py-2 text-sm">
                <span>{e.profiles?.full_name} <span className="font-mono text-xs text-muted-foreground">{e.profiles?.roll_no}</span></span>
                {isAdmin && <Button size="icon" variant="ghost" onClick={() => run(supabase.from("enrollments").delete().eq("course_id", courseId).eq("student_id", e.student_id), "Removed")}><X className="h-4 w-4" /></Button>}
              </li>
            ))}</ul>
          )}
        </section>
      </div>
    </div>
  );
}

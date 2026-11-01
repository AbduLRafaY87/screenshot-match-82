import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loading, ErrorState, PageHeader, Empty } from "@/components/States";
import { quizStatus } from "@/components/course/Quizzes";

export const Route = createFileRoute("/_authenticated/quiz/$quizId")({
  head: () => ({ meta: [{ title: "Quiz — GU Tech LMS" }] }),
  component: QuizPage,
});

type Opt = { id: string; text: string };

function QuizPage() {
  const { quizId } = Route.useParams();
  const { data: me } = useMe();
  const quiz = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("*, courses(code, title)").eq("id", quizId).single();
      if (error) throw error;
      const { data: t } = await supabase.from("course_teachers").select("teacher_id").eq("course_id", data.course_id);
      return { ...data, teacherIds: (t ?? []).map((x) => x.teacher_id) };
    },
  });
  if (!me || quiz.isLoading) return <Loading />;
  if (quiz.error) return <ErrorState error={quiz.error} />;
  const z = quiz.data!;
  const manage = me.role === "admin" || z.teacherIds.includes(me.user.id);
  return (
    <div>
      <Link to="/courses/$courseId" params={{ courseId: z.course_id }} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> {z.courses?.code}</Link>
      <PageHeader title={z.title} subtitle={`${z.time_limit_minutes} min · ${new Date(z.opens_at).toLocaleString()} → ${new Date(z.closes_at).toLocaleString()}`} />
      {manage ? <Builder quiz={z} /> : <Take quiz={z} />}
    </div>
  );
}

function Builder({ quiz }: { quiz: any }) {
  const qc = useQueryClient();
  const qs = useQuery({
    queryKey: ["quiz-qs", quiz.id],
    queryFn: async () => {
      const [q, a, att] = await Promise.all([
        supabase.from("quiz_questions").select("*").eq("quiz_id", quiz.id).order("position"),
        supabase.from("quiz_answers").select("*"),
        supabase.from("quiz_attempts").select("*, profiles(full_name, roll_no)").eq("quiz_id", quiz.id),
      ]);
      if (q.error) throw q.error;
      const ans = new Map((a.data ?? []).map((x) => [x.question_id, x.correct_option_ids]));
      return { questions: q.data.map((x) => ({ ...x, correct: ans.get(x.id) ?? [] })), attempts: att.data ?? [] };
    },
  });
  const [type, setType] = useState<"mcq_single" | "mcq_multi" | "true_false">("mcq_single");
  const [prompt, setPrompt] = useState("");
  const [marks, setMarks] = useState("1");
  const [opts, setOpts] = useState<string[]>(["", "", "", ""]);
  const [correct, setCorrect] = useState<string[]>([]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["quiz-qs", quiz.id] });

  async function add() {
    const options: Opt[] = type === "true_false"
      ? [{ id: "t", text: "True" }, { id: "f", text: "False" }]
      : opts.map((t, i) => ({ id: String.fromCharCode(97 + i), text: t.trim() })).filter((o) => o.text);
    if (prompt.trim().length < 3) { toast.error("Write the question"); return; }
    if (options.length < 2) { toast.error("Add at least 2 options"); return; }
    const valid = correct.filter((c) => options.some((o) => o.id === c));
    if (valid.length === 0) { toast.error("Mark the correct answer"); return; }
    if (type !== "mcq_multi" && valid.length > 1) { toast.error("Only one correct answer for this type"); return; }
    const m = Number(marks);
    if (!(m > 0)) { toast.error("Marks must be positive"); return; }
    const { data, error } = await supabase.from("quiz_questions").insert({ quiz_id: quiz.id, position: (qs.data?.questions.length ?? 0) + 1, type, prompt: prompt.trim(), options, marks: m }).select().single();
    if (error) { toast.error(error.message); return; }
    const r = await supabase.from("quiz_answers").insert({ question_id: data.id, correct_option_ids: valid });
    if (r.error) { toast.error(r.error.message); return; }
    setPrompt(""); setOpts(["", "", "", ""]); setCorrect([]); refresh();
  }

  function toggleCorrect(id: string) {
    setCorrect((c) => (type === "mcq_multi" ? (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]) : [id]));
  }

  async function publish(v: boolean) {
    const { error } = await supabase.from("quizzes").update({ is_published: v }).eq("id", quiz.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["quiz", quiz.id] });
    toast.success(v ? "Published to students" : "Unpublished");
  }

  if (qs.isLoading) return <Loading />;
  if (qs.error) return <ErrorState error={qs.error} />;
  const total = qs.data!.questions.reduce((s, q) => s + Number(q.marks), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-card">
        <Switch checked={quiz.is_published} onCheckedChange={publish} disabled={qs.data!.questions.length === 0} />
        <span className="text-sm font-medium">{quiz.is_published ? "Published — visible to students" : "Draft — hidden from students"}</span>
        <span className="ml-auto text-sm text-muted-foreground">{qs.data!.questions.length} questions · {total} marks</span>
      </div>

      <div className="space-y-3">
        {qs.data!.questions.map((q, i) => (
          <div key={q.id} className="rounded-lg border bg-card p-4 shadow-card">
            <div className="flex justify-between">
              <p className="font-semibold">{i + 1}. {q.prompt} <span className="text-xs font-normal text-muted-foreground">({Number(q.marks)} marks)</span></p>
              <Button size="icon" variant="ghost" onClick={async () => { await supabase.from("quiz_questions").delete().eq("id", q.id); refresh(); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {(q.options as Opt[]).map((o) => <li key={o.id} className={q.correct.includes(o.id) ? "font-semibold text-primary" : ""}>{q.correct.includes(o.id) ? "✓ " : "· "}{o.text}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-dashed bg-card p-5">
        <h3 className="font-bold">Add question</h3>
        <div className="flex flex-wrap gap-3">
          <Select value={type} onValueChange={(v) => { setType(v as any); setCorrect([]); }}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mcq_single">MCQ — one answer</SelectItem>
              <SelectItem value="mcq_multi">MCQ — multiple answers</SelectItem>
              <SelectItem value="true_false">True / False</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2"><Label>Marks</Label><Input className="w-20" type="number" value={marks} onChange={(e) => setMarks(e.target.value)} /></div>
        </div>
        <Input placeholder="Question" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        {type === "true_false" ? (
          <div className="flex gap-2">{[["t", "True"], ["f", "False"]].map(([id, t]) => <Button key={id} type="button" variant={correct.includes(id!) ? "default" : "outline"} onClick={() => toggleCorrect(id!)}>{t}</Button>)}</div>
        ) : (
          <div className="space-y-2">
            {opts.map((o, i) => {
              const id = String.fromCharCode(97 + i);
              return (
                <div key={i} className="flex items-center gap-2">
                  <input type={type === "mcq_multi" ? "checkbox" : "radio"} name="correct" checked={correct.includes(id)} onChange={() => toggleCorrect(id)} aria-label="Correct" />
                  <Input placeholder={`Option ${id.toUpperCase()}`} value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} />
                </div>
              );
            })}
            {opts.length < 6 && <Button type="button" size="sm" variant="ghost" onClick={() => setOpts([...opts, ""])}>+ Option</Button>}
            <p className="text-xs text-muted-foreground">Tick the correct answer{type === "mcq_multi" ? "s" : ""}. Answers are hidden from students.</p>
          </div>
        )}
        <Button onClick={add}><Plus className="h-4 w-4" /> Add question</Button>
      </div>

      <div>
        <h3 className="mb-2 font-bold">Results</h3>
        {qs.data!.attempts.length === 0 ? <Empty title="No attempts yet" /> : (
          <ul className="divide-y rounded-lg border bg-card shadow-card">
            {qs.data!.attempts.map((a: any) => (
              <li key={a.id} className="flex justify-between p-3 text-sm">
                <span>{a.profiles?.full_name} <span className="font-mono text-xs text-muted-foreground">{a.profiles?.roll_no}</span></span>
                <span className="font-semibold">{a.submitted_at ? `${Number(a.score)} / ${total}` : "In progress"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Take({ quiz }: { quiz: any }) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [now, setNow] = useState(Date.now());
  const submitting = useRef(false);
  const st = quizStatus(quiz);

  const attempt = useQuery({
    queryKey: ["my-attempt", quiz.id],
    queryFn: async () => {
      const { data } = await supabase.from("quiz_attempts").select("*").eq("quiz_id", quiz.id).maybeSingle();
      return data;
    },
  });
  const questions = useQuery({
    queryKey: ["take-qs", quiz.id],
    enabled: !!attempt.data && !attempt.data.submitted_at,
    queryFn: async () => {
      const { data, error } = await supabase.from("quiz_questions").select("id, position, type, prompt, options, marks").eq("quiz_id", quiz.id).order("position");
      if (error) throw error;
      return data;
    },
  });

  const deadline = attempt.data ? Math.min(new Date(attempt.data.started_at).getTime() + quiz.time_limit_minutes * 60000, new Date(quiz.closes_at).getTime()) : 0;
  const remaining = Math.max(0, deadline - now);

  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    const { data, error } = await supabase.rpc("submit_quiz", { _quiz: quiz.id, _answers: answers });
    submitting.current = false;
    if (error) { toast.error(error.message); return; }
    toast.success(`Submitted — score ${data}`);
    qc.invalidateQueries({ queryKey: ["my-attempt", quiz.id] });
  }

  useEffect(() => {
    if (!attempt.data || attempt.data.submitted_at) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [attempt.data]);

  useEffect(() => {
    if (attempt.data && !attempt.data.submitted_at && deadline && remaining === 0) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  async function start() {
    const { error } = await supabase.rpc("start_quiz", { _quiz: quiz.id });
    if (error) { toast.error(error.message); return; }
    setNow(Date.now());
    qc.invalidateQueries({ queryKey: ["my-attempt", quiz.id] });
  }

  if (attempt.isLoading) return <Loading />;
  const a = attempt.data;
  if (a?.submitted_at) {
    return (
      <div className="rounded-xl bg-hero p-8 text-primary-foreground shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Submitted</p>
        <p className="mt-2 text-4xl font-extrabold">Score: {Number(a.score)}</p>
        <p className="mt-1 text-sm text-primary-foreground/70">Submitted {new Date(a.submitted_at).toLocaleString()}</p>
      </div>
    );
  }
  if (!a) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-card">
        {quiz.description && <p className="mb-4 text-sm text-muted-foreground">{quiz.description}</p>}
        <ul className="mb-4 list-disc pl-5 text-sm text-muted-foreground">
          <li>You get one attempt with a {quiz.time_limit_minutes}-minute timer.</li>
          <li>The timer keeps running if you leave. Answers submit automatically when time runs out.</li>
        </ul>
        {st === "open" ? <Button onClick={start}><Timer className="h-4 w-4" /> Start quiz</Button>
          : <p className="text-sm font-medium text-destructive">{st === "upcoming" ? "This quiz hasn't opened yet." : "This quiz is closed."}</p>}
      </div>
    );
  }

  const mm = Math.floor(remaining / 60000), ss = Math.floor((remaining % 60000) / 1000);
  return (
    <div className="space-y-4">
      <div className={`sticky top-2 z-10 flex items-center justify-between rounded-lg border p-3 shadow-card ${remaining < 60000 ? "border-destructive bg-destructive/10" : "bg-card"}`}>
        <span className="flex items-center gap-2 font-mono text-lg font-bold"><Timer className="h-5 w-5" /> {mm}:{ss.toString().padStart(2, "0")}</span>
        <Button onClick={submit}>Submit quiz</Button>
      </div>
      {questions.isLoading ? <Loading /> : questions.error ? <ErrorState error={questions.error} /> : questions.data!.map((q, i) => (
        <div key={q.id} className="rounded-lg border bg-card p-5 shadow-card">
          <p className="font-semibold">{i + 1}. {q.prompt} <span className="text-xs font-normal text-muted-foreground">({Number(q.marks)} marks{q.type === "mcq_multi" ? ", select all that apply" : ""})</span></p>
          <div className="mt-3 space-y-2">
            {(q.options as Opt[]).map((o) => {
              const sel = answers[q.id] ?? [];
              const checked = sel.includes(o.id);
              return (
                <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm ${checked ? "border-primary bg-primary/5" : ""}`}>
                  <input type={q.type === "mcq_multi" ? "checkbox" : "radio"} name={q.id} checked={checked}
                    onChange={() => setAnswers({ ...answers, [q.id]: q.type === "mcq_multi" ? (checked ? sel.filter((x) => x !== o.id) : [...sel, o.id]) : [o.id] })} />
                  {o.text}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

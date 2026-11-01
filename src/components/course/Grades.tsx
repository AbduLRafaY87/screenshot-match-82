import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loading, Empty, ErrorState } from "@/components/States";

export function pct(o: number, m: number) {
  return m > 0 ? Math.round((o / m) * 1000) / 10 : 0;
}

export function GradesTab({ courseId, studentView, userId }: { courseId: string; studentView: boolean; userId: string }) {
  const q = useQuery({
    queryKey: ["grades", courseId, studentView],
    queryFn: async () => {
      let qb = supabase.from("v_student_marks").select("*").eq("course_id", courseId);
      if (studentView) qb = qb.eq("student_id", userId);
      const [marks, people] = await Promise.all([
        qb,
        supabase.from("enrollments").select("student_id, profiles(full_name, roll_no)").eq("course_id", courseId),
      ]);
      if (marks.error) throw marks.error;
      return { marks: marks.data, people: people.data ?? [] };
    },
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  const { marks, people } = q.data!;

  if (studentView) {
    if (marks.length === 0) return <Empty title="No graded work yet" />;
    const o = marks.reduce((s, m) => s + Number(m.obtained ?? 0), 0);
    const mx = marks.reduce((s, m) => s + Number(m.max ?? 0), 0);
    return (
      <div className="rounded-lg border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Item</th><th className="p-3">Type</th><th className="p-3 text-right">Marks</th><th className="p-3 text-right">%</th></tr></thead>
          <tbody>
            {marks.map((m) => (
              <tr key={m.item_id!} className="border-t"><td className="p-3">{m.title}</td><td className="p-3 capitalize">{m.kind}</td><td className="p-3 text-right">{Number(m.obtained)} / {Number(m.max)}</td><td className="p-3 text-right">{pct(Number(m.obtained), Number(m.max))}%</td></tr>
            ))}
            <tr className="border-t bg-accent font-bold"><td className="p-3" colSpan={2}>Total</td><td className="p-3 text-right">{o} / {mx}</td><td className="p-3 text-right">{pct(o, mx)}%</td></tr>
          </tbody>
        </table>
      </div>
    );
  }

  const items = Array.from(new Map(marks.map((m) => [m.item_id, { id: m.item_id, title: m.title, max: Number(m.max) }])).values());
  if (people.length === 0) return <Empty title="No students enrolled" />;
  return (
    <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
          <tr><th className="p-3">Student</th>{items.map((i) => <th key={i.id!} className="p-3 text-right">{i.title}<br /><span className="font-normal">/{i.max}</span></th>)}<th className="p-3 text-right">Total %</th></tr>
        </thead>
        <tbody>
          {people.map((p: any) => {
            const mine = marks.filter((m) => m.student_id === p.student_id);
            const o = mine.reduce((s, m) => s + Number(m.obtained ?? 0), 0);
            const mx = mine.reduce((s, m) => s + Number(m.max ?? 0), 0);
            return (
              <tr key={p.student_id} className="border-t">
                <td className="p-3">{p.profiles?.full_name} <span className="font-mono text-xs text-muted-foreground">{p.profiles?.roll_no}</span></td>
                {items.map((i) => { const m = mine.find((x) => x.item_id === i.id); return <td key={i.id!} className="p-3 text-right">{m ? Number(m.obtained) : "—"}</td>; })}
                <td className="p-3 text-right font-semibold">{mx ? `${pct(o, mx)}%` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

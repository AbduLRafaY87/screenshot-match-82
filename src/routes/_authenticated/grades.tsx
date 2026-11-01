import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { pct } from "@/components/course/Grades";
import { Loading, Empty, ErrorState, PageHeader } from "@/components/States";

export const Route = createFileRoute("/_authenticated/grades")({
  head: () => ({ meta: [{ title: "Grades — GU Tech LMS" }] }),
  component: Page,
});

function Page() {
  const { data: me } = useMe();
  const q = useQuery({
    queryKey: ["grade-summary", me?.user.id],
    enabled: !!me,
    queryFn: async () => {
      let mq = supabase.from("v_student_marks").select("*");
      if (me!.role === "student") mq = mq.eq("student_id", me!.user.id);
      const [m, c] = await Promise.all([mq, supabase.from("courses").select("id, code, title").order("code")]);
      if (m.error) throw m.error;
      return (c.data ?? []).map((course) => {
        const rows = (m.data ?? []).filter((x) => x.course_id === course.id);
        const o = rows.reduce((s, x) => s + Number(x.obtained ?? 0), 0);
        const mx = rows.reduce((s, x) => s + Number(x.max ?? 0), 0);
        return { ...course, items: rows.length, o, mx, students: new Set(rows.map((r) => r.student_id)).size };
      });
    },
  });
  if (!me || q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  const student = me.role === "student";
  return (
    <div>
      <PageHeader title={student ? "My grades" : "Gradebook"} subtitle={student ? "Total marks and percentage per course." : "Average performance per course. Open a course for the full gradebook."} />
      {q.data!.length === 0 ? <Empty title="No courses" /> : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Course</th><th className="p-3 text-right">Graded items</th><th className="p-3 text-right">{student ? "Marks" : "Students graded"}</th><th className="p-3 text-right">{student ? "%" : "Average %"}</th></tr>
            </thead>
            <tbody>
              {q.data!.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3"><Link to="/courses/$courseId" params={{ courseId: c.id }} className="font-medium hover:text-primary"><span className="font-bold">{c.code}</span> · {c.title}</Link></td>
                  <td className="p-3 text-right">{c.items}</td>
                  <td className="p-3 text-right">{student ? `${c.o} / ${c.mx}` : c.students}</td>
                  <td className="p-3 text-right font-semibold">{c.mx ? `${pct(c.o, c.mx)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

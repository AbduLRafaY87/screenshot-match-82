import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loading, ErrorState, PageHeader } from "@/components/States";
import { PeopleTab } from "@/components/course/People";
import { MaterialsTab } from "@/components/course/Materials";
import { AssignmentsTab } from "@/components/course/Assignments";
import { QuizzesTab } from "@/components/course/Quizzes";
import { ChatTab } from "@/components/course/Chat";
import { GradesTab } from "@/components/course/Grades";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  head: () => ({ meta: [{ title: "Course — GU Tech LMS" }] }),
  component: CoursePage,
});

function CoursePage() {
  const { courseId } = Route.useParams();
  const { data: me } = useMe();
  const course = useQuery({
    queryKey: ["course-head", courseId, me?.user.id],
    enabled: !!me,
    queryFn: async () => {
      const [c, t] = await Promise.all([
        supabase.from("courses").select("id, code, title, description").eq("id", courseId).single(),
        supabase.from("course_teachers").select("teacher_id").eq("course_id", courseId).eq("teacher_id", me!.user.id),
      ]);
      if (c.error) throw c.error;
      return { ...c.data, teaches: (t.data ?? []).length > 0 };
    },
  });
  if (!me || course.isLoading) return <Loading />;
  if (course.error) return <ErrorState error={course.error} />;
  const c = course.data!;
  const canManage = c.teaches || me.role === "admin";
  const uid = me.user.id;

  return (
    <div>
      <PageHeader title={`${c.code} · ${c.title}`} subtitle={c.description ?? ""} />
      <Tabs defaultValue="materials">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="chat">Class chat</TabsTrigger>
          <TabsTrigger value="grades">{canManage ? "Gradebook" : "My grades"}</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
        </TabsList>
        <TabsContent value="materials"><MaterialsTab courseId={courseId} canManage={canManage} userId={uid} /></TabsContent>
        <TabsContent value="assignments"><AssignmentsTab courseId={courseId} canManage={canManage} userId={uid} /></TabsContent>
        <TabsContent value="quizzes"><QuizzesTab courseId={courseId} canManage={canManage} userId={uid} /></TabsContent>
        <TabsContent value="chat"><ChatTab courseId={courseId} userId={uid} canModerate={canManage} /></TabsContent>
        <TabsContent value="grades"><GradesTab courseId={courseId} studentView={!canManage} userId={uid} /></TabsContent>
        <TabsContent value="people"><PeopleTab courseId={courseId} /></TabsContent>
      </Tabs>
    </div>
  );
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin only");
}

function tempPassword() {
  return "GuTech-" + crypto.randomUUID().slice(0, 8) + "!";
}

const userInput = z.object({
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(2).max(120),
  role: z.enum(["admin", "teacher", "student"]),
  roll_no: z.string().trim().max(60).optional().nullable(),
});

async function createOne(admin: any, u: z.infer<typeof userInput>) {
  const password = tempPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`${u.email}: ${error.message}`);
  const id = data.user.id;
  const p = await admin.from("profiles").insert({
    id,
    email: u.email,
    full_name: u.full_name,
    roll_no: u.roll_no || null,
    must_change_password: true,
  });
  if (p.error) {
    await admin.auth.admin.deleteUser(id);
    throw new Error(`${u.email}: ${p.error.message}`);
  }
  await admin.from("user_roles").insert({ user_id: id, role: u.role });
  return { id, email: u.email, password };
}

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => userInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await createOne(supabaseAdmin, data);
    await supabaseAdmin.from("audit_log").insert({ actor_id: context.userId, action: "create_user", entity: "profiles", entity_id: res.id });
    return res;
  });

export const bulkCreateStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ courseId: z.string().uuid().optional(), rows: z.array(userInput).min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const created: { email: string; password: string }[] = [];
    const errors: string[] = [];
    for (const r of data.rows) {
      try {
        const res = await createOne(supabaseAdmin, r);
        created.push({ email: res.email, password: res.password });
        if (data.courseId) await supabaseAdmin.from("enrollments").insert({ course_id: data.courseId, student_id: res.id });
      } catch (e: any) {
        errors.push(e.message);
      }
    }
    return { created, errors };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.id === context.userId) throw new Error("You cannot deactivate yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.auth.admin.updateUserById(data.id, { ban_duration: data.active ? "none" : "876000h" });
    await supabaseAdmin.from("profiles").update({ is_active: data.active }).eq("id", data.id);
    await supabaseAdmin.from("audit_log").insert({ actor_id: context.userId, action: data.active ? "activate_user" : "deactivate_user", entity: "profiles", entity_id: data.id });
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = tempPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { password });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", data.id);
    return { password };
  });

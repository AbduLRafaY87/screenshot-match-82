import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/States";

export const Route = createFileRoute("/_authenticated/change-password")({
  head: () => ({ meta: [{ title: "Change password — GU Tech LMS" }] }),
  component: Page,
});

const schema = z
  .object({
    current: z.string().min(1, "Required"),
    password: z.string().min(8, "At least 8 characters").regex(/[0-9]/, "Include a number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

function Page() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const forced = me?.profile?.must_change_password;

  const onSubmit = form.handleSubmit(async (v) => {
    const { error } = await supabase.auth.updateUser({ password: v.password, current_password: v.current } as any);
    if (error) { toast.error(error.message); return; }
    await supabase.rpc("mark_password_changed");
    await qc.invalidateQueries({ queryKey: ["me"] });
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  });

  const e = form.formState.errors;
  return (
    <div className="max-w-md">
      <PageHeader title="Change password" subtitle={forced ? "Please set a new password before continuing." : ""} />
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-card p-6 shadow-card">
        <div className="space-y-2"><Label>Current (temporary) password</Label><Input type="password" {...form.register("current")} />{e.current && <p className="text-xs text-destructive">{e.current.message}</p>}</div>
        <div className="space-y-2"><Label>New password</Label><Input type="password" {...form.register("password")} />{e.password && <p className="text-xs text-destructive">{e.password.message}</p>}</div>
        <div className="space-y-2"><Label>Confirm new password</Label><Input type="password" {...form.register("confirm")} />{e.confirm && <p className="text-xs text-destructive">{e.confirm.message}</p>}</div>
        <Button type="submit" disabled={form.formState.isSubmitting}>Update password</Button>
      </form>
    </div>
  );
}

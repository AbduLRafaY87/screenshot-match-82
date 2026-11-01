import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createUser, setUserActive, resetUserPassword } from "@/lib/admin.functions";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loading, Empty, ErrorState, PageHeader } from "@/components/States";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users — GU Tech LMS" }] }),
  component: UsersPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Name required").max(120),
  email: z.string().trim().email("Valid email required"),
  role: z.enum(["admin", "teacher", "student"]),
  roll_no: z.string().trim().max(60).optional(),
});

export function CredentialBox({ email, password }: { email: string; password: string }) {
  return (
    <div className="rounded-md border border-gold bg-accent p-3 text-sm">
      <p className="font-semibold text-accent-foreground">Temporary credentials — share securely</p>
      <p className="mt-1 font-mono text-xs">{email}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs">{password}</p>
        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(`${email} / ${password}`); toast.success("Copied"); }}><Copy className="h-3 w-3" /></Button>
      </div>
    </div>
  );
}

function UsersPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);
  const create = useServerFn(createUser);
  const toggle = useServerFn(setUserActive);
  const reset = useServerFn(resetUserPassword);

  const users = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (p.error) throw p.error;
      const roles = new Map((r.data ?? []).map((x) => [x.user_id, x.role]));
      return p.data.map((u) => ({ ...u, role: roles.get(u.id) ?? "student" }));
    },
  });

  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { role: "student" } });
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const res = await create({ data: v });
      setCreds({ email: res.email, password: res.password });
      form.reset({ role: "student", full_name: "", email: "", roll_no: "" });
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created");
    } catch (e: any) { toast.error(e.message); }
  });

  if (me?.role !== "admin") return <ErrorState error={new Error("Admins only")} />;
  const list = (users.data ?? []).filter((u) => filter === "all" || u.role === filter);

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Create and manage student, teacher and admin accounts."
        action={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCreds(null); }}>
            <DialogTrigger asChild><Button><UserPlus className="h-4 w-4" /> New user</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create account</DialogTitle></DialogHeader>
              {creds ? (
                <div className="space-y-3"><CredentialBox {...creds} /><Button variant="outline" onClick={() => setCreds(null)}>Create another</Button></div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-3">
                  <div className="space-y-1"><Label>Full name</Label><Input {...form.register("full_name")} />{form.formState.errors.full_name && <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>}</div>
                  <div className="space-y-1"><Label>Email</Label><Input type="email" {...form.register("email")} />{form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}</div>
                  <div className="space-y-1"><Label>Role</Label>
                    <Select value={form.watch("role")} onValueChange={(v) => form.setValue("role", v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="teacher">Teacher</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                    </Select>
                  </div>
                  {form.watch("role") === "student" && <div className="space-y-1"><Label>Roll number</Label><Input placeholder="GUTECH-BSCS-2026-001" {...form.register("roll_no")} /></div>}
                  <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>Create with temporary password</Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        }
      />
      <div className="mb-4 flex gap-2">
        {["all", "student", "teacher", "admin"].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">{f}</Button>
        ))}
      </div>
      {users.isLoading ? <Loading /> : users.error ? <ErrorState error={users.error} /> : list.length === 0 ? <Empty title="No users" /> : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Roll no</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3 font-medium">{u.full_name}</td>
                  <td className="p-3 text-muted-foreground">{u.email}</td>
                  <td className="p-3"><Badge variant={u.role === "admin" ? "default" : "secondary"} className="capitalize">{u.role}</Badge></td>
                  <td className="p-3 font-mono text-xs">{u.roll_no ?? "—"}</td>
                  <td className="p-3">{u.is_active ? <span className="text-xs font-semibold text-chart-4">Active</span> : <span className="text-xs font-semibold text-destructive">Deactivated</span>}</td>
                  <td className="space-x-1 p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={async () => {
                      try { const r = await reset({ data: { id: u.id } }); setCreds({ email: u.email, password: r.password }); setOpen(true); } catch (e: any) { toast.error(e.message); }
                    }}>Reset password</Button>
                    {u.id !== me.user.id && (
                      <Button size="sm" variant="ghost" onClick={async () => {
                        try { await toggle({ data: { id: u.id, active: !u.is_active } }); qc.invalidateQueries({ queryKey: ["users"] }); } catch (e: any) { toast.error(e.message); }
                      }}>{u.is_active ? "Deactivate" : "Activate"}</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

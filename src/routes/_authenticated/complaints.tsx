import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { uploadFile, openFile, fileLabel, ALLOWED } from "@/lib/files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loading, Empty, ErrorState, PageHeader } from "@/components/States";

export const Route = createFileRoute("/_authenticated/complaints")({
  head: () => ({ meta: [{ title: "Complaints — GU Tech LMS" }] }),
  component: Page,
});

const CATS = ["academic", "technical", "facility", "conduct", "other"] as const;
const STATUSES = ["open", "in_review", "resolved", "rejected"] as const;
const schema = z.object({
  category: z.enum(CATS),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10, "Please describe the issue (10+ characters)").max(5000),
});

function Page() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const isAdmin = me?.role === "admin";
  const [file, setFile] = useState<File | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const list = useQuery({
    queryKey: ["complaints"],
    queryFn: async () => {
      const { data, error } = await supabase.from("complaints").select("*, profiles!complaints_raised_by_fkey(full_name, email)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { category: "academic" } });
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const attachment_path = file ? await uploadFile(`complaints/${me!.user.id}`, file) : null;
      const { error } = await supabase.from("complaints").insert({ ...v, raised_by: me!.user.id, attachment_path });
      if (error) throw error;
      toast.success("Complaint submitted"); form.reset({ category: "academic", subject: "", description: "" }); setFile(null);
      qc.invalidateQueries({ queryKey: ["complaints"] });
    } catch (e: any) { toast.error(e.message); }
  });

  const rows = (list.data ?? []).filter((c) => filter === "all" || c.status === filter);
  return (
    <div>
      <PageHeader title="Complaints" subtitle={isAdmin ? "Review and respond to complaints." : "Raise an issue with GU Tech administration and track it."} />
      {!isAdmin && (
        <form onSubmit={onSubmit} className="mb-8 space-y-3 rounded-lg border bg-card p-5 shadow-card">
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v as any)}>
              <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Subject" {...form.register("subject")} />
          </div>
          <Textarea rows={4} placeholder="Describe the issue…" {...form.register("description")} />
          {(form.formState.errors.subject || form.formState.errors.description) && <p className="text-xs text-destructive">{form.formState.errors.description?.message ?? "Subject needs 3+ characters"}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Input type="file" accept={ALLOWED} className="max-w-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button type="submit" disabled={form.formState.isSubmitting}>Submit complaint</Button>
          </div>
        </form>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        {["all", ...STATUSES].map((s) => <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)} className="capitalize">{s.replace("_", " ")}</Button>)}
      </div>
      {list.isLoading ? <Loading /> : list.error ? <ErrorState error={list.error} /> : rows.length === 0 ? <Empty title="No complaints" /> : (
        <div className="space-y-3">{rows.map((c: any) => <ComplaintCard key={c.id} c={c} isAdmin={isAdmin} userId={me!.user.id} />)}</div>
      )}
    </div>
  );
}

function ComplaintCard({ c, isAdmin, userId }: { c: any; isAdmin: boolean; userId: string }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>(c.status);
  const [resp, setResp] = useState<string>(c.admin_response ?? "");
  async function save() {
    const done = status === "resolved" || status === "rejected";
    const { error } = await supabase.from("complaints").update({ status: status as any, admin_response: resp.trim() || null, resolved_by: done ? userId : null }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Updated"); qc.invalidateQueries({ queryKey: ["complaints"] });
  }
  const tone = c.status === "resolved" ? "default" : c.status === "rejected" ? "destructive" : "secondary";
  return (
    <div className="rounded-lg border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={tone as any} className="capitalize">{c.status.replace("_", " ")}</Badge>
        <span className="capitalize">{c.category}</span> · {new Date(c.created_at).toLocaleString()}
        {isAdmin && <span>· {c.profiles?.full_name} ({c.profiles?.email})</span>}
      </div>
      <h3 className="mt-2 font-bold">{c.subject}</h3>
      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{c.description}</p>
      {c.attachment_path && <button className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => openFile(c.attachment_path)}><Paperclip className="h-3 w-3" /> {fileLabel(c.attachment_path)}</button>}
      {isAdmin ? (
        <div className="mt-4 space-y-2 border-t pt-4">
          <Label>Response</Label>
          <Textarea value={resp} onChange={(e) => setResp(e.target.value)} />
          <div className="flex gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44 capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      ) : c.admin_response ? (
        <div className="mt-3 rounded-md bg-accent p-3 text-sm"><p className="text-xs font-semibold text-accent-foreground">Administration response</p>{c.admin_response}</div>
      ) : null}
    </div>
  );
}

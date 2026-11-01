import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Download, Trash2, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile, openFile, ALLOWED } from "@/lib/files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loading, Empty, ErrorState } from "@/components/States";

export function MaterialsTab({ courseId, canManage, userId }: { courseId: string; canManage: boolean; userId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["resources", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("resources").select("*").eq("course_id", courseId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function upload() {
    if (!file || title.trim().length < 2) { toast.error("Add a title and choose a file"); return; }
    setBusy(true);
    try {
      const path = await uploadFile(`courses/${courseId}/resources`, file);
      const { error } = await supabase.from("resources").insert({
        course_id: courseId, uploaded_by: userId, title: title.trim(), file_path: path,
        file_name: file.name, mime_type: file.type || "application/octet-stream", size_bytes: file.size,
      });
      if (error) throw error;
      toast.success("Uploaded"); setTitle(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["resources", courseId] });
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4 shadow-card">
          <Input placeholder="Title, e.g. Week 1 slides" value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xs" />
          <Input type="file" accept={ALLOWED} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="max-w-xs" />
          <Button onClick={upload} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload</Button>
          <p className="w-full text-xs text-muted-foreground">PDF, Word, PowerPoint, images or ZIP — up to 25MB.</p>
        </div>
      )}
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} /> : q.data!.length === 0 ? <Empty title="No materials yet" /> : (
        <ul className="divide-y rounded-lg border bg-card shadow-card">
          {q.data!.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-4">
              <FileText className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.file_name} · {(r.size_bytes / 1024 / 1024).toFixed(2)} MB · {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => openFile(r.file_path).catch((e) => toast.error(e.message))}><Download className="h-4 w-4" /> Open</Button>
              {canManage && (
                <Button size="icon" variant="ghost" onClick={async () => {
                  await supabase.storage.from("lms").remove([r.file_path]);
                  await supabase.from("resources").delete().eq("id", r.id);
                  qc.invalidateQueries({ queryKey: ["resources", courseId] });
                }}><Trash2 className="h-4 w-4" /></Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

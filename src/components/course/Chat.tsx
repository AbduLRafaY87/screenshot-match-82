import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loading, ErrorState } from "@/components/States";

export function ChatTab({ courseId, userId, canModerate }: { courseId: string; userId: string; canModerate: boolean }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const key = ["chat", courseId];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_messages").select("*, profiles(full_name)").eq("course_id", courseId).order("created_at").limit(500);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`chat-${courseId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `course_id=eq.${courseId}` }, () => {
        qc.invalidateQueries({ queryKey: ["chat", courseId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [courseId, qc]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [q.data?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || text.length > 2000) return;
    setBody("");
    const { error } = await supabase.from("chat_messages").insert({ course_id: courseId, sender_id: userId, body: text });
    if (error) { toast.error(error.message); setBody(text); }
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-lg border bg-card shadow-card">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} /> : q.data!.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No messages yet — say hello to your class.</p>
        ) : q.data!.map((m: any) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {!mine && <p className="text-xs font-semibold text-primary">{m.profiles?.full_name ?? "Member"}</p>}
                <p className={`whitespace-pre-wrap ${m.deleted_at ? "italic opacity-60" : ""}`}>{m.deleted_at ? "Message removed" : m.body}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] opacity-60">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {!m.deleted_at && (mine || canModerate) && (
                    <button className="hidden group-hover:inline" onClick={() => supabase.from("chat_messages").update({ deleted_at: new Date().toISOString() }).eq("id", m.id)}><Trash2 className="h-3 w-3" /></button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t p-3">
        <Input value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} placeholder="Message the class…" />
        <Button type="submit" size="icon" aria-label="Send"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

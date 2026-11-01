import { supabase } from "@/integrations/supabase/client";

export const MAX_BYTES = 25 * 1024 * 1024;
export const ALLOWED = ".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.zip,.txt";

export async function uploadFile(folder: string, file: File) {
  if (file.size > MAX_BYTES) throw new Error("File is larger than 25MB");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from("lms").upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw error;
  return path;
}

export async function openFile(path: string) {
  const { data, error } = await supabase.storage.from("lms").createSignedUrl(path, 60);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}

export function fileLabel(path: string) {
  return path.split("/").pop()!.replace(/^[0-9a-f-]{36}-/, "");
}

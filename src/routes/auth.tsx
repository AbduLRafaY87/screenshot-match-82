import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — GU Tech LMS" },
      { name: "description", content: "Sign in to the GU Tech learning management system." },
      { property: "og:title", content: "Sign in — GU Tech LMS" },
      { property: "og:description", content: "Access your GU Tech courses, classes and administration tools." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password is required"),
});

function AuthPage() {
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = form.handleSubmit(async (v) => {
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword(v);
    if (error) { setErr(error.message.includes("banned") ? "This account has been deactivated." : error.message); return; }
    navigate({ to: "/dashboard", replace: true });
  });

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-hero p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold text-gold-foreground">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="text-lg font-bold tracking-tight">GU Tech</span>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-gold">Learning Management System</p>
          <h1 className="text-5xl font-extrabold leading-tight">Ghazali University<br />School of Technology</h1>
          <p className="mt-4 max-w-md text-primary-foreground/70">Courses, assignments, quizzes and classroom conversations — in one place.</p>
        </div>
        <p className="text-xs text-primary-foreground/50">Accounts are issued by GU Tech administration.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-extrabold">Sign in</h2>
            <p className="text-sm text-muted-foreground">Use the credentials provided by your administrator.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
            {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
            {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
          </div>
          {err && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{err}</p>}
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
          </Button>
          <p className="text-center text-xs text-muted-foreground">No account? Contact GU Tech administration.</p>
        </form>
      </div>
    </div>
  );
}

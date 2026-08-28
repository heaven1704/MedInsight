"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Activity, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  requested_role: z.enum(["doctor", "receptionist"]),
});
type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { requested_role: "doctor" },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await api.post("/api/auth/signup/", values, { skipAuth: true });
      setSubmitted(true);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Signup failed");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#E2D9D0] bg-white p-8 shadow-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#C1674F]/10"><Activity className="h-6 w-6 text-[#C1674F]" /></div>
          <div><h1 className="text-2xl font-semibold text-[#3D3A38]">Request access</h1><p className="mt-1 text-sm text-[#9C9490]">Create a clinic account for admin approval</p></div>
        </div>
        {submitted ? (
          <div className="space-y-4 text-center"><p className="rounded-lg border border-[#6B8F71]/30 bg-[#6B8F71]/10 px-4 py-3 text-sm text-[#3F6347]">Signup submitted. Your account is awaiting admin approval.</p><Link href="/login" className="text-sm font-medium text-[#C1674F] hover:underline">Return to sign in</Link></div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{serverError}</p>}
            <div className="space-y-1.5"><Label htmlFor="full_name">Full name</Label><Input id="full_name" {...register("full_name")} />{errors.full_name && <p className="text-xs text-red-600">{errors.full_name.message}</p>}</div>
            <div className="space-y-1.5"><Label htmlFor="username">Username</Label><Input id="username" {...register("username")} />{errors.username && <p className="text-xs text-red-600">{errors.username.message}</p>}</div>
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" {...register("email")} />{errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}</div>
            <div className="space-y-1.5"><Label>Role</Label><Select defaultValue="doctor" onValueChange={(value) => setValue("requested_role", value as FormValues["requested_role"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="doctor">Doctor</SelectItem><SelectItem value="receptionist">Receptionist</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" {...register("password")} />{errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}</div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : "Request access"}</Button>
            <p className="text-center text-sm text-[#6B6460]">Already registered? <Link href="/login" className="font-medium text-[#C1674F] hover:underline">Sign in</Link></p>
          </form>
        )}
      </div>
    </div>
  );
}

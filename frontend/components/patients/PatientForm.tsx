"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { PatientFormValues } from "@/types";

// ── Zod schema ─────────────────────────────────────────────────────────────

const patientSchema = z.object({
  full_name:       z.string().min(2, "Full name must be at least 2 characters"),
  date_of_birth:   z.string().nullish(),
  gender:          z.enum(["male", "female", "other"], { message: "Select a gender" }),
  phone:           z.string().nullish(),
  email:           z.string().email("Invalid email address").or(z.literal("")).default(""),
  address:         z.string().default(""),
  blood_group:     z.enum(["A+","A-","B+","B-","AB+","AB-","O+","O-","unknown"]).nullish(),
  allergies:       z.string().default(""),
  medical_history: z.string().default(""),
});

export type PatientFormSchema = z.infer<typeof patientSchema>;

// ── Props ──────────────────────────────────────────────────────────────────

interface PatientFormProps {
  defaultValues?: Partial<PatientFormValues>;
  onSubmit: (values: PatientFormSchema) => Promise<void>;
  submitLabel?: string;
  isEditing?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

export function PatientForm({
  defaultValues,
  onSubmit,
  submitLabel = "Save Patient",
  isEditing = false,
}: PatientFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormSchema, unknown, PatientFormSchema>({
    resolver: zodResolver(patientSchema) as never,
    defaultValues: {
      blood_group: undefined,
      gender: "male",
      email: "",
      address: "",
      allergies: "",
      medical_history: "",
      ...defaultValues,
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({
          ...values,
          date_of_birth: values.date_of_birth || null,
          phone: values.phone ?? "",
        })
      )}
      className="space-y-6"
      noValidate
    >

      {/* ── Personal Information ─────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-[#C1674F] uppercase tracking-wide">
          Personal Information
        </legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Full name */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              placeholder="e.g. Arjun Sharma"
              {...register("full_name")}
              aria-invalid={!!errors.full_name}
            />
            {errors.full_name && (
              <p className="text-xs text-red-600">{errors.full_name.message}</p>
            )}
          </div>

          {/* Date of birth */}
          <div className="space-y-1.5">
            <Label htmlFor="date_of_birth">Date of Birth</Label>
            <Input
              id="date_of_birth"
              type="date"
              {...register("date_of_birth")}
              aria-invalid={!!errors.date_of_birth}
            />
            {errors.date_of_birth && (
              <p className="text-xs text-red-600">{errors.date_of_birth.message}</p>
            )}
          </div>

          {/* Gender */}
          <div className="space-y-1.5">
            <Label htmlFor="gender">Gender *</Label>
            <Select
              defaultValue={defaultValues?.gender ?? "male"}
              onValueChange={(v) => setValue("gender", v as PatientFormSchema["gender"])}
            >
              <SelectTrigger id="gender" aria-invalid={!!errors.gender}>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {errors.gender && (
              <p className="text-xs text-red-600">{errors.gender.message}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="e.g. 9876543210"
              {...register("phone")}
              aria-invalid={!!errors.phone}
            />
            {errors.phone && (
              <p className="text-xs text-red-600">{errors.phone.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="e.g. patient@example.com"
              {...register("email")}
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <p className="text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          {/* Address */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="Street, City, State"
              {...register("address")}
            />
          </div>
        </div>
      </fieldset>

      {/* ── Medical Information ──────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-[#C1674F] uppercase tracking-wide">
          Medical Information
        </legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Blood group */}
          <div className="space-y-1.5">
            <Label htmlFor="blood_group">Blood Group</Label>
            <Select
              defaultValue={defaultValues?.blood_group ?? undefined}
              onValueChange={(v) => setValue("blood_group", v as PatientFormSchema["blood_group"])}
            >
              <SelectTrigger id="blood_group">
                <SelectValue placeholder="Select blood group (optional)" />
              </SelectTrigger>
              <SelectContent>
                {["A+","A-","B+","B-","AB+","AB-","O+","O-","unknown"].map((bg) => (
                  <SelectItem key={bg} value={bg}>{bg === "unknown" ? "Unknown" : bg}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Allergies */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="allergies">Known Allergies</Label>
            <textarea
              id="allergies"
              rows={2}
              placeholder="List any known allergies, e.g. Penicillin, Aspirin…"
              className="flex w-full rounded-md border border-[#E2D9D0] bg-white px-3 py-2 text-sm text-[#3D3A38] placeholder:text-[#9C9490] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1674F] focus-visible:ring-offset-1 resize-none"
              {...register("allergies")}
            />
          </div>

          {/* Medical history */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="medical_history">Medical History</Label>
            <textarea
              id="medical_history"
              rows={4}
              placeholder="Prior diagnoses, surgeries, chronic conditions…"
              className="flex w-full rounded-md border border-[#E2D9D0] bg-white px-3 py-2 text-sm text-[#3D3A38] placeholder:text-[#9C9490] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1674F] focus-visible:ring-offset-1 resize-none"
              {...register("medical_history")}
            />
          </div>
        </div>
      </fieldset>

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}

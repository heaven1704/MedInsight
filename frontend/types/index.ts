// ── Auth ──────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "doctor" | "receptionist";

export interface CurrentUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginResponse extends AuthTokens {
  user: CurrentUser;
}

// ── Family ────────────────────────────────────────────────────────────────

export interface Family {
  id: number;
  family_name: string;
  member_count: number;
  created_at: string;
}

// ── Patient ───────────────────────────────────────────────────────────────

export type Gender = "male" | "female" | "other";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "unknown";

export interface Patient {
  id: number;
  full_name: string;
  date_of_birth: string;       // ISO date  "YYYY-MM-DD"
  gender: Gender;
  phone: string;
  email: string;
  address: string;
  blood_group: BloodGroup;
  allergies: string | null;    // null when clinical access is restricted
  medical_history: string | null;
  family: number | null;       // FK id
  family_detail: Family | null;
  created_at: string;
  updated_at: string;
}

/** Lighter shape returned by the list endpoint */
export interface PatientListItem {
  id: number;
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  phone: string;
  email: string;
  blood_group: BloodGroup;
  family: number | null;
  family_name: string | null;
  last_visit: string | null;
}

// ── Paginated response wrapper ─────────────────────────────────────────────

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ── Forms ─────────────────────────────────────────────────────────────────

export interface PatientFormValues {
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  phone: string;
  email: string;
  address: string;
  blood_group: BloodGroup;
  allergies: string;
  medical_history: string;
}

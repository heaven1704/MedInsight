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

// ── Appointments ───────────────────────────────────────────────────────────

export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export interface AppointmentPatientDetail {
  id: number;
  full_name: string;
  phone: string;
}

export interface AppointmentDoctorDetail {
  id: number;
  username: string;
  full_name: string;
}

/** Full shape — returned by retrieve / create / update */
export interface Appointment {
  id: number;
  patient: number;
  patient_detail: AppointmentPatientDetail | null;
  doctor: number | null;
  doctor_detail: AppointmentDoctorDetail | null;
  date: string;       // "YYYY-MM-DD"
  time: string;       // "HH:MM:SS"
  reason: string;
  status: AppointmentStatus;
  warnings: string[]; // non-empty when an overlap was detected on save
}

/** Lighter shape returned by the list endpoint */
export interface AppointmentListItem {
  id: number;
  patient: number;
  patient_name: string;
  doctor: number | null;
  doctor_name: string | null;
  date: string;
  time: string;
  reason: string;
  status: AppointmentStatus;
}

export interface AppointmentFormValues {
  patient: number;
  doctor: number | null;
  date: string;
  time: string;
  reason: string;
  status: AppointmentStatus;
}

// ── Documents ──────────────────────────────────────────────────────────────

export type DocumentType =
  | "prescription"
  | "lab_report"
  | "invoice"
  | "medical_record"
  | "other";

export type ProcessingStatus = "uploaded" | "processing" | "processed" | "needs_review";

export interface Document {
  id: number;
  patient: number;
  file: string;
  document_type: DocumentType;
  tags: string;
  uploaded_at: string;
  processing_status: ProcessingStatus;
  extracted_text: string;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

/** Lightweight document row surfaced on the dashboard (with OCR status). */
export interface DashboardRecentDocument {
  id: number;
  patient_id: number;
  patient_name: string;
  document_type: DocumentType;
  file: string | null;
  uploaded_at: string;
  processing_status: ProcessingStatus;
}

/** A patient with unresolved family-grouping matches (same phone/address). */
export interface FamilySuggestion {
  id: number;
  full_name: string;
  phone: string;
  match_count: number;
  match_names: string[];
}

export interface DashboardSummary {
  total_patients: number;
  todays_appointments_count: number;
  completed_appointments_count: number;
  pending_appointments_count: number;
  recent_patients: PatientListItem[];
  recent_documents: DashboardRecentDocument[];
  family_suggestions: FamilySuggestion[];
}

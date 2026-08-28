import { AppShell } from "@/components/layout/AppShell";

export default function PatientsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

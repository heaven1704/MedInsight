import { redirect } from "next/navigation";

// Root → redirect to the landing dashboard (auth guard is in the AppShell)
export default function Home() {
  redirect("/dashboard");
}

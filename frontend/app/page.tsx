import { redirect } from "next/navigation";

// Root → redirect to patients list (auth guard is in the patients layout)
export default function Home() {
  redirect("/patients");
}

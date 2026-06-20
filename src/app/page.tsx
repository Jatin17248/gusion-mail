import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { NewLanding } from "@/app/_components/new-landing";

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return <NewLanding />;
}

import RegisterMain from "@/_components/auth/RegisterMain";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register",
  description: "Create a Gusion Mail account to start managing your emails with AI automation.",
};

export default function RegisterPage() {
  return <RegisterMain />;
}
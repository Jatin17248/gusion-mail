import LoginMain from "@/_components/auth/LoginMain";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login – Gusion Mail",
  description: "Sign in to Gusion Mail — your AI-powered email client.",
};

export default function LoginPage() {
  return <LoginMain />;
}


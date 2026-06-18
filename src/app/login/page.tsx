import LoginMain from "@/_components/auth/LoginMain";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Login to your Gusion QR account to manage your business reviews and reputation.",
};

export default function LoginPage() {
  return <LoginMain />;
}


import RegisterMain from "@/_components/auth/RegisterMain";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register",
  description: "Create a Gusion QR account to start managing your Google Business Profile reviews with AI automation.",
};

export default function RegisterPage() {
  return <RegisterMain />;
}
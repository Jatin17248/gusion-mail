import "@/styles/globals.css";
import { type Metadata } from "next";
import { Inter } from "next/font/google";
import { TRPCReactProvider } from "@/trpc/react";
import { Toaster } from "sonner";
import { SessionProvider } from "next-auth/react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gusion Mail — AI Command Center",
  description: "Keyboard-first Gmail & Calendar command center powered by AI.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased min-h-screen`}>
        <SessionProvider>
          <TRPCReactProvider>
            {children}
            <Toaster position="bottom-right" closeButton richColors />
          </TRPCReactProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

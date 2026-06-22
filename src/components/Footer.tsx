import { cn } from "@/lib/utils";
import Link from "next/link";
import React from "react";
import FeatureSlider from "./FeatureSlider";
import Image from "next/image";
import { Mail, Calendar } from "lucide-react";

const Footer = ({ className }: React.ComponentProps<"footer">) => {
  return (
    <>
      <footer className={cn("border-t-[3px] border-[#fff2e0] py-4 relative overflow-hidden bg-[#fff2e0]", className)}>
        <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-[#e61f2a] via-indigo-50 to-[#e61f2a]" />
        
        <section className="relative px-4 max-w-[1280px] mx-auto text-gray-500 grid md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_27%] gap-10 py-10 text-sm">

          {/* COLUMN 1: Integrations & Features */}
          <div>
            <h3 className="text-gray-900 font-semibold mb-3">
              Integrations
            </h3>
            <div className="flex gap-2 flex-col">
              <div className="flex gap-2.5 flex-col mt-1">
                {[
                  { name: "Gmail & Google Workspace", icon: Mail },
                  { name: "Google Calendar Sync", icon: Calendar },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href="/register"
                      className="text-gray-900 font-medium flex items-center gap-2 mt-1.5"
                    >
                      <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>

            <h3 className="text-gray-900 font-semibold mt-8 mb-3">
              Platform Features
            </h3>
            <div className="flex gap-2 flex-col">
              <div className="flex gap-2.5 flex-col mt-1">
                {[
                  "Superhuman Navigation",
                  "AI Draft Agent",
                  "Daily Morning Brief",
                  "Integrated Scheduling",
                  "Unified Inbox Accounts",
                ].map((item) => (
                  <Link
                    key={item}
                    href="/#features"
                    className="text-gray-600 hover:text-black hover:underline"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* COLUMN 2: Solutions & Resources */}
          <div>
            <h3 className="text-gray-900 font-semibold mb-3">
              Solutions
            </h3>
            <div className="flex gap-2 flex-col">
              <div className="flex gap-2.5 flex-col mt-1">
                {[
                  "High-Growth Teams",
                  "Modern Professionals",
                  "Productivity Experts",
                  "Enterprise Workspaces",
                ].map((item) => (
                  <a
                    key={item}
                    className="text-gray-600 hover:text-black hover:underline"
                    href="#"
                  >
                    {item}
                  </a>
                ))}
              </div>
            </div>

            <h3 className="text-gray-900 font-semibold mb-3 mt-8">
              Resources
            </h3>
            <div className="flex gap-2 flex-col">
              <div className="flex gap-2.5 flex-col mt-1">
                {[
                  { title: "Blogs", link: "/blog" },
                  { title: "Help Center", link: "/contact" },
                  { title: "Support Email", link: "mailto:jatin@omsoftwares.in" },
                  { title: "Business Email", link: "mailto:jatin@omsoftwares.in" },
                ].map((item) => (
                  <Link
                    key={item.title}
                    className="text-gray-600 hover:text-black hover:underline"
                    href={item.link}
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* COLUMN 3: Company & Legal */}
          <div>
            <h3 className="text-gray-900 font-semibold mb-3">Company</h3>
            <div className="flex gap-2 flex-col">
              <div className="flex gap-2.5 flex-col mt-1">
                <Link href="/privacy" className="text-gray-600 hover:text-black hover:underline">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="text-gray-600 hover:text-black hover:underline">
                  Terms of Service
                </Link>
                <Link href="/terms" className="text-gray-600 hover:text-black hover:underline">
                  Cancellation and Refund
                </Link>
                <Link href="/terms" className="text-gray-600 hover:text-black hover:underline">
                  Shipping and Exchange
                </Link>
              </div>
            </div>

            <h3 className="text-gray-900 font-semibold mb-3 mt-8">
              Quick Links
            </h3>
            <div className="flex gap-2 flex-col">
              <div className="flex gap-2.5 flex-col mt-1">
                {[
                  { title: "Dashboard", link: "/" },
                  { title: "Sign In", link: "/login" },
                  { title: "Sign Up", link: "/register" },
                  { title: "Features", link: "/#features" },
                ].map((item) => (
                  <Link
                    key={item.title}
                    className="text-gray-600 hover:text-black hover:underline"
                    href={item.link}
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* COLUMN 4: Brand & Social */}
          <div className="flex flex-col justify-between">
            <div className="leading-[1.6]">
              <Link href="/">
                <Image
                  src="/images/logo2.svg"
                  alt="Gusion Mail"
                  width={200}
                  height={45}
                />
              </Link>
              <p className="text-indigo-500 font-medium italic text-sm mt-2">Keyboard-first navigation meets AI speed.</p>
              <p className="mt-1 text-gray-500 text-sm text-justify">
                The secure, keyboard-first AI email workspace built for modern professionals. Connect your Gmail and Google Workspace accounts to experience lightning-fast workflow speeds.
              </p>
            </div>

            <FeatureSlider need={1} />
          </div>
        </section>

        {/* Footer Bottom */}
        <section className="relative px-4 max-w-[1080px] md:text-center text-gray-300 text-sm flex items-center justify-center gap-2 mx-auto mt-8 pb-2">
          <div>© {new Date().getFullYear()} Gusion Mail. All rights reserved.</div>
        </section>

        <section className="relative px-4 max-w-[1080px] text-center text-gray-100 flex items-center justify-center gap-2 mx-auto pb-2 pointer-events-none font-bold -mb-[11%] sm:-mb-[7%]">
          <div className="relative w-full max-w-[1000px] aspect-[1000/300] opacity-80 drop-shadow-xl animate-[pulse_4s_infinite] select-none">
            <Image
              src="/images/logoFooter.svg"
              alt="Gusion Mail Footer"
              fill
              className="object-contain"
              sizes="(max-width: 1024px) 100vw, 1000px"
            />
          </div>

          <div className="bg-linear-to-b from-transparent via-white to-white h-[20%] w-full absolute bottom-0 left-0 z-20"></div>
        </section>

      </footer>
    </>
  );
};

export default Footer;

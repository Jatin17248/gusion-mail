"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Navbar,
  NavBody,
  NavbarLogo,
  MobileNav,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "@/components/ui/resizable-navbar";
import ModalBody1 from "@/components/ModalBody";
import { Modal, ModalTrigger } from "./ui/animated-modal";
import { navItems } from "@/config/navigation";
import { useRouter } from "next/navigation";


function DesktopNav({ items }: { items: any[] }) {
  const pathname = usePathname();
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  // Close dropdown on route change
  useEffect(() => {
    setOpenDropdown(null);
  }, [pathname]);

  // Helper to check if the item is active (exact match or parent for dropdowns)
  const isActive = (href: string) => {
    if (!href) return false;
    // Exact match or starts with href (for parent dropdowns)
    return pathname === href || (href !== "/" && pathname.startsWith(href));
  };
  return (
    <ul className="flex items-center justify-center gap-4">
      {items.map((item, idx) => {
        return (
          <li
            key={item.title}
            className={`relative font-medium transition-colors  
        ${item.children ? "hide-between-custom" : ""}
        `}
            onMouseEnter={() => item.children && setOpenDropdown(idx)}
            onMouseLeave={() => item.children && setOpenDropdown(null)}
          >
            {item.children ? (
              <div className="flex flex-col ">
                <div className="flex items-center">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={`peer hover:text-blue-600 flex items-center gap-1 px-4 py-2 font-medium transition-colors ${isActive(item.href) ? "border-b-2 border-blue-600" : ""
                        }`}
                    >
                      {item.title}
                      {/* Down arrow */}
                      <svg
                        className="ml-1 h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </Link>
                  ) : (
                    <span className="peer flex items-center gap-1 px-4 py-2 font-medium transition-colors">
                      {item.title}
                    </span>
                  )}
                </div>
                <div
                  className={`absolute left-0 top-full z-50 min-w-[230px] w-70 ${openDropdown === idx ? "block" : "hidden"
                    }`}
                >
                  <DropdownMenu items={item.children} depth={1} />
                </div>
              </div>
            ) : (
              <Link
                href={item.href}
                className={`block px-4 py-2 font-medium hover:text-blue-600 ${isActive(item.href) ? "border-b-2 border-blue-600" : ""
                  }`}
              >
                {item.title}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DropdownMenu({ items, depth = 1 }: { items: any[]; depth?: number }) {
  return (
    <ul className="rounded-md bg-white py-2 shadow-lg dark:bg-neutral-900">
      {items.map((item) => {
        return (
          <li key={item.title} className="relative group/menu">
            {item.children ? (
              <>
                <div className="flex items-center">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="hover:text-blue-600 flex w-full justify-between items-center gap-1 px-4 py-2 font-medium transition-colors group-hover/menu:bg-neutral-100 group-focus-within/menu:bg-neutral-100 dark:group-hover/menu:bg-neutral-800 dark:group-focus-within/menu:bg-neutral-800"
                    >
                      <div className="flex justify-between items-center">
                        {item.title}
                      </div>

                      {/* Right arrow */}
                      <svg
                        className="ml-1 h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  ) : (
                    <span className="flex w-full items-center gap-1 px-4 py-2 font-medium transition-colors group-hover/menu:bg-neutral-100 group-focus-within/menu:bg-neutral-100 dark:group-hover/menu:bg-neutral-800 dark:group-focus-within/menu:bg-neutral-800">
                      {item.title}
                    </span>
                  )}
                </div>
                <div className="absolute left-full top-0 z-50 hidden min-w-65 group-hover/menu:block group-focus-within/menu:block">
                  <DropdownMenu items={item.children} depth={depth + 1} />
                </div>
              </>
            ) : (
              <Link
                href={item.href}
                className="block px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-blue-600"
              >
                <div className="flex justify-start items-center">
                  {item.title}
                </div>
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*                     mobile nav (accordion‑style list)                      */
/* -------------------------------------------------------------------------- */

function MobileNavList({
  items,
  closeMenu,
  level = 0,
}: {
  items: any[];
  closeMenu: () => void;
  level?: number;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <ul className="flex w-full flex-col items-start gap-0">
      {items.map((item, idx) => {
        return (
          <li
            key={item.title}
            className="w-full
         font-semibold focus:outline-none 
        "
          >
            {item.children ? (
              <>
                <button
                  onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                  aria-expanded={openIndex === idx}
                  className={`flex w-full items-center justify-between px-4 py-2 font-semibold focus:outline-none ${openIndex === idx
                      ? "bg-neutral-100 dark:bg-neutral-800"
                      : ""
                    }`}
                >
                  <Link href={item.href} onClick={closeMenu}>
                    <span className="flex items-center gap-1">
                      {item.title}
                    </span>
                  </Link>

                  <svg
                    className={`ml-2 h-4 w-4 transition-transform ${openIndex === idx ? "rotate-90" : ""
                      }`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
                {openIndex === idx && (
                  <div className="pl-4">
                    <MobileNavList
                      items={item.children}
                      closeMenu={closeMenu}
                      level={level + 1}
                    />
                  </div>
                )}
              </>
            ) : (
              <Link
                href={item.href}
                className="block w-full rounded px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                onClick={closeMenu}
              >
                <div className="flex justify-start items-center">
                  {item.title}
                </div>
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Header                                     */
/* -------------------------------------------------------------------------- */

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);
  const router = useRouter();

  return (
    <Modal>
      <Navbar>
        {/* --------------------------- Desktop Nav --------------------------- */}
        <NavBody>
          <NavbarLogo />

          <nav className="hidden flex-1 lg:block">
            <DesktopNav items={navItems} />
          </nav>

          <div className="flex items-center gap-3">
            {/* 🔆 / 🌙 theme toggle */}
            {/* <ThemeToggle /> */}

            {/* Modal Trigger */}
            <ModalTrigger className="bg-[#0067ff] hover:bg-blue-600 !text-white flex justify-center group/modal-btn rounded-md border-none cursor-pointer">
              <span className="group-hover/modal-btn:translate-x-40 text-center transition duration-500">
                Book a call
              </span>
              <div className="-translate-x-40 group-hover/modal-btn:translate-x-0 flex items-center justify-center absolute inset-0 transition duration-500 text-white z-20">
                ✈️
              </div>
            </ModalTrigger>

            <button onClick={() => router.push('/register')} className="bg-[#e61f2a] hover:bg-red-600 !text-white flex justify-center group/modal-btn px-4 py-2 rounded-md text-center relative overflow-hidden cursor-pointer border-none">
              <span className="group-hover/modal-btn:translate-x-40 text-center transition duration-500">
                Register Now!
              </span>
              <div className="-translate-x-40 group-hover/modal-btn:translate-x-0 flex items-center justify-center absolute inset-0 transition duration-500 text-white z-20">
                ✈️
              </div>
            </button>
          </div>
        </NavBody>

        {/* --------------------------- Mobile Nav ---------------------------- */}
        <MobileNav>
          <MobileNavHeader>
            <NavbarLogo />
            <div className="flex items-center gap-3">
              {/* show toggle on mobile header too */}
              {/* <ThemeToggle /> */}
              <MobileNavToggle
                isOpen={isMobileMenuOpen}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              />
            </div>
          </MobileNavHeader>

          <MobileNavMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          >
            <div className="max-h-[80vh] w-full overflow-y-auto">
              <MobileNavList
                items={navItems}
                closeMenu={() => setIsMobileMenuOpen(false)}
              />
            </div>

            <div className="mt-4 flex w-full flex-col gap-4">
              <ModalTrigger
                className="bg-[#0067ff] text-white flex justify-center group/modal-btn
                  px-4 py-2 text-center relative overflow-hidden no-underline space-x-2 cursor-pointer transition duration-200 h-14 hover:shadow-2xl rounded-2xl font-semibold w-full"
              >
                <span className="group-hover/modal-btn:translate-x-125 text-center flex justify-center items-center transition duration-500  ">
                  &nbsp;Book a call
                </span>
                <div className="-translate-x-125 group-hover/modal-btn:translate-x-0 flex items-center justify-center absolute inset-0 transition duration-500 text-white z-20">
                  ✈️
                </div>
              </ModalTrigger>
            </div>
            <button onClick={() => router.push('/register')}
              className="bg-[#e61f2a] text-white flex justify-center group/modal-btn
                  px-4 py-2 text-center items-center relative overflow-hidden no-underline space-x-2 cursor-pointer transition duration-200 h-14 hover:shadow-2xl rounded-2xl font-semibold w-full"
            >
              Register Now!
            </button>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>

      <ModalBody1 />
    </Modal>
  );
}

export default Header;

export interface NavItem {
  title: string;
  href: string;
  children?: NavItem[];
}

export interface NavItem {
  title: string;
  href: string;
  children?: NavItem[];
  breadCrumbImg?: string;
  jsonPath?: string;
}

export const navItems: NavItem[] = [
  {
    title: "Home",
    href: "/",
  },
  {
    title: "About",
    href: "/about",
  },
 
 {
    title: "Blogs",
    href: "/blogs",
  },
  {
    title: "Contact",
    href: "/contact",
  },
];

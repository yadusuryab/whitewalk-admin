"use client";
import { usePathname } from "next/navigation";
import { Package, ShoppingBag, Settings, Star } from "lucide-react";
import Link from "next/link";

const navItems = [
  { href: "/admin", label: "Products", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-primary/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:sticky md:inset-x-auto md:top-0 md:border-b md:border-t-0 md:pb-0">
      <ul className="mx-auto grid max-w-3xl grid-cols-4 md:flex md:justify-center md:gap-10">
        {navItems.map(({ href, label, icon: Icon }, i) => {
          const active =
            href === "/admin" ? pathname === href : pathname.startsWith(href);

          return (
            <li key={href} className="relative">
              <Link
                href={href}
                style={{ animationDelay: `${i * 70}ms` }}
                className={`group flex flex-col items-center gap-1 py-3 text-[9px] font-bold uppercase tracking-[0.2em] transition-colors duration-300 animate-in fade-in slide-in-from-bottom-2 fill-mode-both md:flex-row md:gap-2 md:py-4 md:text-[11px] ${
                  active ? "text-white" : "text-white/40 hover:text-white"
                }`}
              >
                <span className="hidden text-secondary md:inline">
                  0{i + 1}
                </span>
                <Icon
                  className={`h-5 w-5 transition-transform duration-300 md:hidden ${
                    active ? "-translate-y-0.5 text-secondary" : "group-active:scale-90"
                  }`}
                  strokeWidth={active ? 2.5 : 1.75}
                />
                <span>{label}</span>

                {/* active indicator: top bar on mobile, underline on desktop */}
                <span
                  className={`absolute left-1/2 h-0.5 -translate-x-1/2 bg-secondary transition-all duration-500 ease-out top-0 md:bottom-0 md:top-auto ${
                    active ? "w-8 md:w-full" : "w-0 group-hover:w-4 md:group-hover:w-full"
                  }`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
"use client";
import Link from "next/link";

export function AdminHeader() {
  return (
    <header className="relative flex items-center justify-center px-4 py-5 bg-primary border-b border-white/10 animate-in fade-in slide-in-from-top-2 duration-700">
      <Link
        href="/admin"
        className="group flex items-center gap-3 text-white"
      >
        <span className="relative h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-secondary animate-ping opacity-75" />
          <span className="relative block h-2 w-2 rounded-full bg-secondary" />
        </span>

        <h2 className="relative text-xl md:text-3xl font-black uppercase tracking-[-0.04em] leading-none">
          White<span className="font-light">Walk</span>
          <span className="absolute -bottom-1.5 left-0 h-[2px] w-0 bg-secondary transition-all duration-500 ease-out group-hover:w-full" />
        </h2>

        <span className="text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] px-2.5 py-1 border border-white/40 rounded-full transition-all duration-300 group-hover:bg-secondary group-hover:border-secondary group-hover:tracking-[0.4em]">
          Admin
        </span>
      </Link>
    </header>
  );
}
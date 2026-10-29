// app/admin/layout.tsx
import { Inter_Tight } from "next/font/google";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/header";
import { AdminNav } from "@/components/admin/nav";

// Loaded once here instead of once per page.
const display = Inter_Tight({
  subsets: ["latin"],
  weight: ["500", "600", "800"],
  display: "swap",
});

async function checkAuth() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return false;

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify`, {
      headers: { Cookie: `admin_token=${token}` },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await checkAuth())) redirect("/login");

  return (
    <div className={`${display.className} min-h-screen bg-white text-neutral-950`}>
      <AdminHeader />
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-8">
        {children}
      </main>
    </div>
  );
}
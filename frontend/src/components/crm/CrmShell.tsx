"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Columns3, Inbox, LayoutDashboard, LogOut } from "lucide-react";
import { useCrmAuth } from "./CrmAuthProvider";

const NAV = [
  { href: "/crm/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/crm/leads", label: "Заявки", icon: Inbox },
  { href: "/crm/kanban", label: "Канбан", icon: Columns3 },
];

export default function CrmShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useCrmAuth();
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace("/crm/login");
  }

  return (
    <div className="flex min-h-screen bg-blue-light/40">
      <aside className="flex w-60 shrink-0 flex-col border-r border-black/5 bg-white">
        <div className="px-5 py-5">
          <span className="text-lg font-bold text-navy">
            Слетать<span className="text-gold">.ру</span>
          </span>
          <p className="text-[11px] text-foreground/50">мини-CRM</p>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-navy text-white" : "text-navy/70 hover:bg-blue-light"
                }`}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-black/5 bg-white px-6 py-3">
          <div />
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-navy">{user?.full_name}</p>
              <p className="text-[11px] text-foreground/50">
                {user?.is_head ? "Руководитель" : "Менеджер"}
              </p>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Выйти"
              className="flex h-9 w-9 items-center justify-center rounded-full text-navy/50 hover:bg-blue-light hover:text-navy"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

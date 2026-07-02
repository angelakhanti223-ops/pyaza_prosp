"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CrmAuthProvider, useCrmAuth } from "@/components/crm/CrmAuthProvider";
import CrmShell from "@/components/crm/CrmShell";

function Guard({ children }: { children: React.ReactNode }) {
  const { status } = useCrmAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/crm/login";

  useEffect(() => {
    if (status === "unauthenticated" && !isLoginPage) {
      router.replace("/crm/login");
    }
  }, [status, isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-foreground/50">
        Проверяем доступ…
      </div>
    );
  }

  return <CrmShell>{children}</CrmShell>;
}

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmAuthProvider>
      <Guard>{children}</Guard>
    </CrmAuthProvider>
  );
}

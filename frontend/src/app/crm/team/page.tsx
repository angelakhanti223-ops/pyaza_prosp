"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { listCrmTeamMembers, mediaUrl, type TeamMemberCrm } from "@/lib/crmApi";

export default function CrmTeamPage() {
  const [members, setMembers] = useState<TeamMemberCrm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCrmTeamMembers().then((data) => {
      setMembers(data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-navy">Команда</h1>
        <Link
          href="/crm/team/new"
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue"
        >
          + Новый сотрудник
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-foreground/50">Загрузка…</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-foreground/40">Сотрудников пока нет</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const photo = mediaUrl(member.photo ?? "");
            return (
              <Link
                key={member.id}
                href={`/crm/team/${member.id}`}
                className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-5 transition-colors hover:border-blue/30 hover:bg-blue-light/20"
              >
                {member.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={member.name} className="h-12 w-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-light text-blue">
                    <User size={20} />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-navy">{member.name}</h2>
                  <p className="truncate text-xs text-foreground/50">{member.role}</p>
                  {!member.is_active && (
                    <span className="mt-1 inline-block rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-foreground/50">
                      Скрыт с сайта
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

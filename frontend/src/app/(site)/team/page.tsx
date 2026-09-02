import type { Metadata } from "next";
import { Mail, Phone, User } from "lucide-react";
import PageHero from "@/components/ui/PageHero";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";
import { fetchTeamMembers } from "@/lib/api";
import { mediaUrl } from "@/lib/articlesApi";

export const metadata: Metadata = {
  title: "Наша команда — туристическое агентство Слетать.ру в Пензе",
  description:
    "Команда турагентства Слетать.ру в Пензе: кто подбирает ваш тур, за какие направления отвечает каждый специалист и как с нами связаться.",
};

export default async function TeamPage() {
  const team = await fetchTeamMembers();

  return (
    <div>
      <PageHero
        title="Наша команда"
        text="С вами работают живые люди, а не скрипт продаж — познакомьтесь с теми, кто подбирает вашу поездку."
      />
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        {team.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {team.map((member) => {
              const photo = mediaUrl(member.photo);
              return (
                <div key={member.id} className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-4">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={member.name} className="h-16 w-16 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-light text-blue">
                        <User size={26} />
                      </div>
                    )}
                    <div>
                      <h2 className="font-bold text-navy">{member.name}</h2>
                      <p className="text-sm text-gold">{member.role}</p>
                    </div>
                  </div>
                  {member.bio && (
                    <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-foreground/70">{member.bio}</p>
                  )}
                  {(member.phone || member.email) && (
                    <div className="mt-4 flex flex-col gap-1.5 text-sm text-foreground/60">
                      {member.phone && (
                        <a
                          href={`tel:${member.phone.replace(/[^\d+]/g, "")}`}
                          className="flex items-center gap-2 hover:text-navy"
                        >
                          <Phone size={14} className="text-gold" />
                          {member.phone}
                        </a>
                      )}
                      {member.email && (
                        <a href={`mailto:${member.email}`} className="flex items-center gap-2 hover:text-navy">
                          <Mail size={14} className="text-gold" />
                          {member.email}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-sm text-foreground/50">Информация о команде скоро появится здесь.</p>
        )}
        <div className="mt-12 text-center">
          <OpenLeadFormButton className="rounded-full bg-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue">
            Подобрать тур
          </OpenLeadFormButton>
        </div>
      </div>
    </div>
  );
}

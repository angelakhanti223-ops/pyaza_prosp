"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { ApiError, createLead } from "@/lib/api";

type Step = {
  key: "name" | "phone" | "email" | "country" | "budget" | "group" | "dates" | "wishes";
  question: (answers: Record<string, string>) => string;
  placeholder: string;
  type: "text" | "tel" | "email";
  optional?: boolean;
};

const STEPS: Step[] = [
  {
    key: "name",
    question: () => "Здравствуйте! 👋 Помогу подобрать тур. Как вас зовут?",
    placeholder: "Ваше имя",
    type: "text",
  },
  {
    key: "phone",
    question: (a) => `Приятно познакомиться, ${a.name}! Оставьте номер телефона, чтобы мы могли связаться`,
    placeholder: "+7 999 123-45-67",
    type: "tel",
  },
  {
    key: "email",
    question: () => "Email для связи (необязательно)",
    placeholder: "you@example.com",
    type: "email",
    optional: true,
  },
  { key: "country", question: () => "Куда хотите отправиться?", placeholder: "Например, Турция", type: "text" },
  {
    key: "budget",
    question: () => "Какой бюджет на поездку рассматриваете?",
    placeholder: "Например, 150 000 ₽ на двоих",
    type: "text",
  },
  {
    key: "group",
    question: () => "Кто едет и сколько человек?",
    placeholder: "Например, 2 взрослых и 1 ребёнок",
    type: "text",
  },
  {
    key: "dates",
    question: () => "Когда планируете поездку и на сколько ночей?",
    placeholder: "Например, 10–20 августа, 10 ночей",
    type: "text",
  },
  {
    key: "wishes",
    question: () => "Что для вас важно в отдыхе?",
    placeholder: "Например, всё включено, рядом с морем",
    type: "text",
  },
];

type Message = { from: "bot" | "user"; text: string };
type Phase = "chatting" | "consent" | "submitting" | "done" | "error";

function buildSummary(answers: Record<string, string>): string {
  return [
    answers.country && `Страна: ${answers.country}`,
    answers.budget && `Бюджет: ${answers.budget}`,
    answers.group && `Состав: ${answers.group}`,
    answers.dates && `Даты и число ночей: ${answers.dates}`,
    answers.wishes && `Пожелания: ${answers.wishes}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState("");
  const [phase, setPhase] = useState<Phase>("chatting");
  const [consent, setConsent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, phase]);

  function openWidget() {
    setIsOpen(true);
    if (!started) {
      setStarted(true);
      setMessages([{ from: "bot", text: STEPS[0].question({}) }]);
    }
  }

  function askNext(nextIndex: number, currentAnswers: Record<string, string>) {
    if (nextIndex >= STEPS.length) {
      setPhase("consent");
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Спасибо! Остался последний шаг — согласие на обработку персональных данных." },
      ]);
      return;
    }
    setStepIndex(nextIndex);
    setTimeout(() => {
      setMessages((m) => [...m, { from: "bot", text: STEPS[nextIndex].question(currentAnswers) }]);
    }, 400);
  }

  function handleSend() {
    const step = STEPS[stepIndex];
    const value = inputValue.trim();
    if (!value && !step.optional) return;

    const nextAnswers = { ...answers, [step.key]: value };
    setAnswers(nextAnswers);
    setMessages((m) => [...m, { from: "user", text: value || "Пропустить" }]);
    setInputValue("");
    askNext(stepIndex + 1, nextAnswers);
  }

  function handleSkip() {
    setMessages((m) => [...m, { from: "user", text: "Пропустить" }]);
    askNext(stepIndex + 1, answers);
  }

  async function handleSubmit() {
    if (!consent) return;
    setPhase("submitting");
    try {
      await createLead({
        name: answers.name,
        phone: answers.phone,
        email: answers.email || undefined,
        initial_comment: buildSummary(answers),
        consent: true,
        source: "chatbot",
      });
      setPhase("done");
      setMessages((m) => [
        ...m,
        { from: "bot", text: `Спасибо, ${answers.name}! Заявка отправлена, наш менеджер скоро свяжется с вами.` },
      ]);
    } catch (err) {
      setPhase("error");
      const detail = err instanceof ApiError ? Object.values(err.fieldErrors).flat().join(" ") : "";
      setMessages((m) => [
        ...m,
        {
          from: "bot",
          text: detail || "Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам напрямую.",
        },
      ]);
    }
  }

  const currentStep = STEPS[stepIndex];

  return (
    <>
      <button
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : openWidget())}
        aria-label={isOpen ? "Закрыть чат" : "Чат с помощником"}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-navy-dark shadow-lg transition-transform hover:scale-105"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-5 z-40 flex h-[480px] w-[92vw] max-w-[340px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="bg-navy px-5 py-4">
            <p className="text-sm font-bold text-white">
              Слетать<span className="text-gold">.ру</span>
            </p>
            <p className="text-xs text-white/60">Онлайн-помощник по подбору тура</p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            <div className="flex flex-col gap-2">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.from === "bot" ? "self-start bg-blue-light text-navy" : "self-end bg-navy text-white"
                  }`}
                >
                  {m.text}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-black/5 p-3">
            {phase === "chatting" && (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type={currentStep.type}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={currentStep.placeholder}
                  className="flex-1 rounded-full border border-black/10 px-4 py-2 text-sm outline-none focus:border-blue"
                />
                {currentStep.optional && (
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="shrink-0 text-xs text-foreground/40 hover:text-foreground"
                  >
                    Пропустить
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSend}
                  aria-label="Отправить"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-white hover:bg-blue"
                >
                  <Send size={15} />
                </button>
              </div>
            )}

            {phase === "consent" && (
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-2 text-xs text-foreground/70">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Согласен на обработку персональных данных в соответствии с{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
                      политикой конфиденциальности
                    </a>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!consent}
                  className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-blue disabled:opacity-50"
                >
                  Отправить заявку
                </button>
              </div>
            )}

            {phase === "submitting" && <p className="text-center text-xs text-foreground/40">Отправляем…</p>}

            {phase === "error" && (
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-blue"
              >
                Попробовать снова
              </button>
            )}

            {phase === "done" && (
              <p className="text-center text-xs text-foreground/40">Спасибо! Мы скоро свяжемся с вами.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

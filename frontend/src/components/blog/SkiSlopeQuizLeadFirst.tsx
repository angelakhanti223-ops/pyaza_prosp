"use client";

import { useMemo, useState } from "react";
import { ApiError, createLead } from "@/lib/api";

type ResultKey = "beginner" | "family" | "scenic" | "active" | "freeride" | "premium";

type Option = {
  label: string;
  description: string;
  result: ResultKey;
};

type Question = {
  title: string;
  options: Option[];
};

const QUESTIONS: Question[] = [
  {
    title: "Какой у вас опыт катания?",
    options: [
      { label: "Никогда не катались", description: "Нужен спокойный старт, инструктор и простой склон.", result: "beginner" },
      { label: "Катались пару раз", description: "Хочется понятных трасс и без лишнего напряжения.", result: "family" },
      { label: "Катаетесь уверенно", description: "Нужны длинные трассы, скорость и разнообразие.", result: "active" },
      { label: "Любите сложные маршруты", description: "Интересны рельеф, снег, высота и фрирайд.", result: "freeride" },
    ],
  },
  {
    title: "С кем планируете поездку?",
    options: [
      { label: "Парой", description: "Важны виды, отель, атмосфера и красивые вечера.", result: "scenic" },
      { label: "С детьми", description: "Нужны школа катания, питание, безопасность и простая логистика.", result: "family" },
      { label: "Компанией", description: "Хочется кататься днём и отдыхать вечером.", result: "active" },
      { label: "В премиальном формате", description: "Нужны сервис, SPA, трансфер и хороший отель.", result: "premium" },
    ],
  },
  {
    title: "Что главное в горном отдыхе?",
    options: [
      { label: "Научиться кататься", description: "Без страха, перегруза и сложных трасс.", result: "beginner" },
      { label: "Отдохнуть всей семьёй", description: "Чтобы взрослым и детям было удобно.", result: "family" },
      { label: "Красивые виды", description: "Катание важно, но не единственная цель поездки.", result: "scenic" },
      { label: "Максимум катания", description: "Хочется трасс, перепада высот и активного дня.", result: "active" },
    ],
  },
  {
    title: "Какой уровень комфорта нужен?",
    options: [
      { label: "Бюджетно и понятно", description: "Главное — снег, инструктор и нормальная логистика.", result: "beginner" },
      { label: "Комфортно с семьёй", description: "Отель рядом, питание, школа и прогулки.", result: "family" },
      { label: "Красиво и атмосферно", description: "Хочется уютный курорт, кафе, виды и прогулки.", result: "scenic" },
      { label: "Премиально", description: "Хороший отель, SPA, рестораны, трансфер, сервис.", result: "premium" },
    ],
  },
  {
    title: "Какие страны вам ближе?",
    options: [
      { label: "Россия и ближние страны", description: "Архыз, Красная Поляна, Азербайджан, Грузия, Турция.", result: "family" },
      { label: "Европейские Альпы", description: "Франция, Швейцария, Италия, Австрия, Андорра.", result: "premium" },
      { label: "Необычные маршруты", description: "Китай, Казахстан, Киргизия и нестандартные программы.", result: "freeride" },
      { label: "Где больше трасс", description: "Выбираем не страну, а масштаб зоны катания.", result: "active" },
    ],
  },
];

const RESULTS: Record<ResultKey, {
  title: string;
  subtitle: string;
  tracks: string;
  resorts: string[];
  cta: string;
}> = {
  beginner: {
    title: "Вам подойдут мягкие учебные склоны",
    subtitle: "Ваш формат — спокойный старт, инструктор, зелёные и синие трассы, прокат и отель без сложной логистики.",
    tracks: "Зелёные и простые синие трассы, учебные зоны, короткие подъёмники, инструктор.",
    resorts: ["Архыз", "Красная Поляна", "Шахдаг и Туфандаг, Азербайджан", "Бакуриани, Грузия", "Цахкадзор, Армения", "Эрджиес, Турция", "Банско, Болгария"],
    cta: "Подберём курорт, где будет комфортно учиться, а первая поездка в горы не превратится в стресс.",
  },
  family: {
    title: "Вам подойдут семейные горы",
    subtitle: "Главное — не только трассы, а удобство всей поездки: дети, школа катания, питание, отель, трансфер и отдых вне склона.",
    tracks: "Зелёные и синие трассы, семейные зоны, инструкторы, детские школы, спокойные спуски.",
    resorts: ["Архыз", "Красная Поляна", "Шахдаг, Азербайджан", "Бакуриани, Грузия", "Эрджиес и Улудаг, Турция", "Ливиньо и Доломиты, Италия", "Андорра"],
    cta: "Соберём семейный горный отдых с правильными трассами, школой, отелем, питанием и логистикой.",
  },
  scenic: {
    title: "Вам подойдут горы с атмосферой и красивыми видами",
    subtitle: "Для вас горы — это не только спорт. Важны панорамы, прогулки, кафе, SPA, красивые отели и ощущение зимнего отпуска.",
    tracks: "Синие и красные трассы, прогулочные зоны, рестораны, SPA, видовые подъёмники.",
    resorts: ["Красная Поляна", "Гудаури, Грузия", "Шымбулак, Казахстан", "Эрджиес, Турция", "Кицбюэль, Австрия", "Доломиты, Италия", "Церматт, Швейцария"],
    cta: "Подберём курорт, где будут виды, хороший отель, прогулки и трассы под ваш уровень.",
  },
  active: {
    title: "Вам подойдут активные трассы и большая зона катания",
    subtitle: "Вы хотите кататься много, разнообразно и не скучать после первого дня. Важны перепады высот, количество трасс и качество подъёмников.",
    tracks: "Синие, красные и отдельные чёрные трассы, длинные спуски, большие зоны катания.",
    resorts: ["Красная Поляна", "Шерегеш", "Эльбрус", "Гудаури, Грузия", "Паландокен и Эрджиес, Турция", "Три Долины, Франция", "Тинь и Валь-д’Изер, Франция", "Давос и Церматт, Швейцария", "Зёльден, Австрия"],
    cta: "Подберём курорт, где вам не будет скучно: по трассам, снегу, сезону и уровню группы.",
  },
  freeride: {
    title: "Вам подойдут фрирайд и большие горы",
    subtitle: "Ваш формат — снег, простор, рельеф, гиды и настоящие горы. Здесь важно выбирать не по картинкам, а по сезону и безопасности.",
    tracks: "Чёрные трассы, зоны вне трасс, гиды, лавинная безопасность, расширенная страховка.",
    resorts: ["Шерегеш", "Эльбрус", "Гудаури, Грузия", "Красная Поляна", "Шамони, Франция", "Тинь, Франция", "Вербье, Швейцария", "Санкт-Антон, Австрия", "Казахстан и Киргизия для опытных групп"],
    cta: "Проверим сезон, снег, гидов, страховку и уровень группы перед подбором маршрута.",
  },
  premium: {
    title: "Вам подойдёт премиальный горный отпуск",
    subtitle: "Горы для вас — полноценный отпуск: сильный отель, SPA, рестораны, трансфер, сервис и красивое окружение.",
    tracks: "Синие, красные и видовые трассы, ski-in/ski-out, SPA-отели, рестораны, индивидуальные инструкторы.",
    resorts: ["Санкт-Мориц, Швейцария", "Церматт, Швейцария", "Вербье, Швейцария", "Куршевель и Мерибель, Франция", "Валь-д’Изер, Франция", "Кортина-д’Ампеццо, Италия", "Кицбюэль, Австрия", "Красная Поляна в премиальном формате"],
    cta: "Соберём горный отпуск с отелем, трансфером, SPA, ресторанами и удобным доступом к трассам.",
  },
};

function apiErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return Object.values(error.fieldErrors)[0]?.[0] || "Не удалось отправить заявку. Попробуйте ещё раз.";
  }
  return "Не удалось отправить заявку. Попробуйте ещё раз.";
}

export default function SkiSlopeQuizLeadFirst() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<(Option | null)[]>(Array(QUESTIONS.length).fill(null));
  const [leadCreated, setLeadCreated] = useState(false);
  const [resultSubmitted, setResultSubmitted] = useState(false);
  const [status, setStatus] = useState<"idle" | "starting" | "submitting" | "success" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  const canStart = name.trim() && phone.trim() && consent;
  const isComplete = answers.every(Boolean);

  const resultKey = useMemo<ResultKey>(() => {
    const score: Record<ResultKey, number> = { beginner: 0, family: 0, scenic: 0, active: 0, freeride: 0, premium: 0 };
    answers.forEach((answer) => {
      if (answer) score[answer.result] += 1;
    });
    return (Object.entries(score).sort((a, b) => b[1] - a[1])[0]?.[0] as ResultKey) || "beginner";
  }, [answers]);

  const result = RESULTS[resultKey];

  function selectAnswer(questionIndex: number, option: Option) {
    setAnswers((current) => current.map((item, index) => (index === questionIndex ? option : item)));
  }

  async function startQuiz() {
    if (!canStart || status === "starting") return;
    setStatus("starting");
    setErrorText("");

    try {
      await createLead({
        name,
        phone,
        email: email || undefined,
        consent,
        source: "site_form",
        initial_comment:
          "Клиент начал тест по горным склонам. Контакты сохранены до прохождения теста. Тема: подбор горнолыжного тура.",
      });
      setLeadCreated(true);
      setStarted(true);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setErrorText(apiErrorMessage(error));
    }
  }

  async function submitResult() {
    if (!isComplete || !canStart || resultSubmitted) return;
    setStatus("submitting");
    setErrorText("");

    const answerText = answers
      .map((answer, index) => `${index + 1}. ${QUESTIONS[index].title}: ${answer?.label}`)
      .join("\n");

    try {
      await createLead({
        name,
        phone,
        email: email || undefined,
        consent,
        source: "site_form",
        initial_comment: `Результат теста по горным склонам: ${result.title}.\n${result.cta}\n\nОтветы:\n${answerText}`,
      });
      setResultSubmitted(true);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorText(apiErrorMessage(error));
    }
  }

  return (
    <section id="ski-slope-test" className="mt-8 overflow-hidden rounded-3xl border border-blue-light bg-white shadow-sm">
      <div className="bg-navy px-5 py-6 text-white sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Тест для подбора гор</p>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Какие горы и какой склон вам подойдут?</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
          Сначала оставьте контакты: заявка создаётся сразу при старте теста. Затем ответьте на 5 вопросов и отправьте результат менеджеру.
        </p>
      </div>

      <div className="p-5 sm:p-7">
        {!started ? (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
                className="rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue"
              />
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Телефон"
                className="rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                type="email"
                className="rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue"
              />
            </div>
            <label className="flex items-start gap-2 text-xs leading-5 text-foreground/70">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1"
              />
              <span>
                Я согласен/согласна на обработку персональных данных. Контакты нужны, чтобы сохранить результат теста и подготовить подбор горного отдыха.
              </span>
            </label>
            <button
              type="button"
              disabled={!canStart || status === "starting"}
              onClick={startQuiz}
              className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-navy transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "starting" ? "Создаём заявку…" : "Начать тест"}
            </button>
            {status === "error" && <p className="text-sm text-red-600">{errorText}</p>}
          </div>
        ) : (
          <div className="space-y-7">
            {leadCreated && (
              <div className="rounded-2xl bg-blue-light/60 p-4 text-sm text-blue">
                Контакты сохранены. Заявка уже создана в CRM. После прохождения теста можно отправить менеджеру результат.
              </div>
            )}

            {QUESTIONS.map((question, questionIndex) => (
              <div key={question.title} className="rounded-3xl bg-blue-light/40 p-4 sm:p-5">
                <h3 className="text-base font-bold text-navy">{questionIndex + 1}. {question.title}</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {question.options.map((option) => {
                    const active = answers[questionIndex]?.label === option.label;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => selectAnswer(questionIndex, option)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          active ? "border-blue bg-white shadow-sm" : "border-transparent bg-white/70 hover:bg-white"
                        }`}
                      >
                        <span className="block text-sm font-semibold text-navy">{option.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-foreground/65">{option.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {isComplete && (
              <div className="rounded-3xl border border-gold/40 bg-gold/10 p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue">Ваш результат</p>
                <h3 className="mt-2 text-2xl font-bold text-navy">{result.title}</h3>
                <p className="mt-3 text-sm leading-6 text-foreground/75">{result.subtitle}</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold text-navy">Тип трасс</p>
                    <p className="mt-1 text-sm leading-6 text-foreground/70">{result.tracks}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy">Куда смотреть</p>
                    <ul className="mt-1 space-y-1 text-sm text-foreground/70">
                      {result.resorts.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-6 text-foreground/75">{result.cta}</p>

                {resultSubmitted ? (
                  <div className="mt-5 rounded-2xl bg-white p-4 text-sm font-semibold text-blue">
                    Результат отправлен. Менеджер свяжется с вами и предложит варианты по тесту.
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={submitResult}
                    disabled={status === "submitting"}
                    className="mt-5 rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue disabled:opacity-60"
                  >
                    {status === "submitting" ? "Отправляем…" : "Отправить результат менеджеру"}
                  </button>
                )}
                {status === "error" && <p className="mt-3 text-sm text-red-600">{errorText}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

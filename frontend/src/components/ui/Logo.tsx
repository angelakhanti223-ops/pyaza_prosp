import Link from "next/link";

export default function Logo({ variant = "light" }: { variant?: "light" | "dark" }) {
  const isDark = variant === "dark";
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="17" cy="17" r="17" fill={isDark ? "#ffffff" : "var(--color-blue)"} />
        <path
          d="M9 20.5 17 9l8 11.5-8-3.5-8 3.5Z"
          fill={isDark ? "var(--color-navy)" : "#ffffff"}
        />
        <path d="M17 17v8" stroke={isDark ? "var(--color-navy)" : "#ffffff"} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span>
        <span className={`block text-lg font-bold leading-none ${isDark ? "text-white" : "text-navy"}`}>
          Слетать<span className="text-gold">.ру</span>
        </span>
        <span className={`block text-[10px] leading-tight ${isDark ? "text-white/60" : "text-navy/50"}`}>
          сеть туристических агентств
        </span>
      </span>
    </Link>
  );
}

import Image from "next/image";
import Link from "next/link";

export default function Logo({ variant = "light" }: { variant?: "light" | "dark" }) {
  const isDark = variant === "dark";
  const image = (
    <Image src="/logo.jpg" alt="Слетать.ру — сеть туристических агентств" width={56} height={56} className="rounded-lg" />
  );

  return (
    <Link href="/" className="flex items-center">
      {isDark ? <div className="rounded-xl bg-white p-1.5">{image}</div> : image}
    </Link>
  );
}

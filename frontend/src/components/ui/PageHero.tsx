export default function PageHero({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-gradient-to-b from-blue-light to-white">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-navy sm:text-4xl">{title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-foreground/70">{text}</p>
      </div>
    </div>
  );
}

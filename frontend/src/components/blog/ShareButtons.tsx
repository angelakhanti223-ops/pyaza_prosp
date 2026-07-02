"use client";

import { useState } from "react";
import { Link2, Send } from "lucide-react";

export default function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const vkUrl = `https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-foreground/50">Поделиться:</span>
      <a
        href={vkUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Поделиться ВКонтакте"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-light text-blue hover:bg-blue hover:text-white"
      >
        <span className="text-[11px] font-bold">VK</span>
      </a>
      <a
        href={tgUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Поделиться в Telegram"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-light text-blue hover:bg-blue hover:text-white"
      >
        <Send size={14} />
      </a>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Скопировать ссылку"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-light text-blue hover:bg-blue hover:text-white"
      >
        <Link2 size={14} />
      </button>
      {copied && <span className="text-xs text-foreground/50">Скопировано</span>}
    </div>
  );
}

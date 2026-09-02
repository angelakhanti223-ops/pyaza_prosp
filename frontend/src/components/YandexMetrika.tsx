"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";

const YANDEX_METRIKA_ID = 112172044;

declare global {
  interface Window {
    ym?: (id: number, action: string, ...args: unknown[]) => void;
  }
}

export default function YandexMetrika() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRender = useRef(true);
  // CRM — внутренний инструмент для сотрудников, не публичная часть сайта,
  // его посещения незачем и не нужно отправлять в веб-аналитику.
  const isCrm = pathname.startsWith("/crm");

  useEffect(() => {
    if (isCrm) return;
    if (isFirstRender.current) {
      // Первый просмотр этого пути уже учтён вызовом init() в самом скрипте ниже.
      isFirstRender.current = false;
      return;
    }
    // App Router переходит между страницами без перезагрузки — без ручного
    // hit() Метрика увидела бы только самый первый открытый посетителем адрес.
    const url = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    window.ym?.(YANDEX_METRIKA_ID, "hit", url);
  }, [pathname, searchParams, isCrm]);

  if (isCrm) return null;

  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">
        {`
          (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window, document,'script','https://mc.webvisor.org/metrika/tag_ww.js?id=${YANDEX_METRIKA_ID}', 'ym');

          ym(${YANDEX_METRIKA_ID}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
        `}
      </Script>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${YANDEX_METRIKA_ID}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}

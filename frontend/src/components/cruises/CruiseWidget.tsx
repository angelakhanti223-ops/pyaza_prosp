"use client";

import Script from "next/script";

const CES_SETTINGS = {
  email: "esevruga@gmail.com",
  theme: "dark",
  currencies: ["RUB"],
  lang: "ru",
};

export default function CruiseWidget() {
  return (
    <>
      <link rel="stylesheet" href="https://widget.gocruise.ru/css/app.css" />
      <link rel="stylesheet" href="https://widget.gocruise.ru/css/themes/dark.css" />
      <Script id="ces-settings" strategy="afterInteractive">
        {`window.cesSettings = ${JSON.stringify(CES_SETTINGS)};`}
      </Script>
      <Script
        src="https://widget.gocruise.ru/js/app.js"
        strategy="afterInteractive"
        onLoad={() => {
          // Виджет монтирует себя только по событию DOMContentLoaded
          // (document.addEventListener("DOMContentLoaded", () => Wn.$mount("#ces"))
          // внутри их бандла) — а Next.js подключает этот скрипт уже после того,
          // как это событие давно прошло, так что оно никогда не срабатывает
          // само. Переотправляем его вручную сразу после загрузки скрипта.
          document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true, cancelable: true }));
        }}
      />
      <div id="ces" />
    </>
  );
}

import Script from "next/script";
import { CONSENT_KEY } from "@/lib/consent";

const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const PLAUSIBLE_HOST =
  process.env.NEXT_PUBLIC_PLAUSIBLE_HOST ?? "https://plausible.io";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function Analytics() {
  return (
    <>
      {PLAUSIBLE_DOMAIN && (
        <Script
          defer
          data-domain={PLAUSIBLE_DOMAIN}
          src={`${PLAUSIBLE_HOST}/js/script.tagged-events.js`}
          strategy="afterInteractive"
        />
      )}

      {PLAUSIBLE_DOMAIN && (
        <Script id="plausible-init" strategy="afterInteractive">
          {`window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}`}
        </Script>
      )}

      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          {/*
            Consent Mode v2. Encolamos los comandos en dataLayer en orden:
            consent 'default' ANTES de 'config', de modo que gtag.js los procese
            en ese orden al cargar. Por defecto analytics_storage está "denied":
            GA no escribe cookies (_ga, _ga_*) hasta que el usuario acepta en el
            banner. Si ya aceptó en una visita anterior, lo leemos de localStorage
            y arrancamos directamente en "granted".
          */}
          <Script id="ga-init" strategy="afterInteractive">
            {`
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;
var __consent='denied';
try{var __s=window.localStorage.getItem(${JSON.stringify(CONSENT_KEY)});if(__s==='granted'){__consent='granted';}}catch(e){}
gtag('consent','default',{'analytics_storage':__consent,'ad_storage':'denied','ad_user_data':'denied','ad_personalization':'denied','wait_for_update':500});
gtag('js',new Date());
gtag('config','${GA_ID}',{anonymize_ip:true});
`}
          </Script>
        </>
      )}
    </>
  );
}

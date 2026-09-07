"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, MessageCircle, ShieldCheck } from "lucide-react";

type SignupState = "idle" | "opening" | "finishing" | "connected" | "error";
type SignupResult = { wabaId?: string; phoneNumberId?: string };

type FacebookLoginResponse = { authResponse?: { code?: string }; status?: string };
type FacebookSdk = {
  init(options: { appId: string; cookie: boolean; xfbml: boolean; version: string }): void;
  login(callback: (response: FacebookLoginResponse) => void, options: Record<string, unknown>): void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || "1735228224390278";
const CONFIG_ID = process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID || "1991012558271468";

export function WhatsAppEmbeddedSignup({ initialConnection }: { initialConnection?: { displayPhoneNumber: string } }) {
  const [sdkReady, setSdkReady] = useState(false);
  const [state, setState] = useState<SignupState>(initialConnection ? "connected" : "idle");
  const [message, setMessage] = useState(initialConnection ? `WhatsApp quedó conectado al CRM${initialConnection.displayPhoneNumber ? `: ${initialConnection.displayPhoneNumber}` : ""}.` : "");
  const [signupSignal, setSignupSignal] = useState(0);
  const signupResult = useRef<SignupResult>({});
  const authCode = useRef("");
  const completing = useRef(false);

  useEffect(() => {
    function initialize() {
      window.FB?.init({ appId: APP_ID, cookie: true, xfbml: false, version: "v23.0" });
      setSdkReady(Boolean(window.FB));
    }

    window.fbAsyncInit = initialize;
    if (window.FB) initialize();
    else if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/es_LA/sdk.js";
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        setState("error");
        setMessage("No se pudo cargar la conexión segura de Meta. Revisá el bloqueador de ventanas y volvé a intentar.");
      };
      document.head.appendChild(script);
    }

    function receiveSignupEvent(event: MessageEvent) {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
      let payload = event.data;
      if (typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch { return; }
      }
      if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (payload.event === "FINISH") {
        signupResult.current = {
          wabaId: payload.data?.waba_id,
          phoneNumberId: payload.data?.phone_number_id,
        };
        setSignupSignal((value) => value + 1);
        setState("finishing");
        setMessage("Meta autorizó el número. Estamos terminando la conexión con el CRM…");
      } else if (payload.event === "CANCEL") {
        setState("idle");
        setMessage("La vinculación quedó pendiente. Podés retomarla cuando quieras.");
      } else if (payload.event === "ERROR") {
        setState("error");
        setMessage(payload.data?.error_message || "Meta no pudo completar la vinculación.");
      }
    }

    window.addEventListener("message", receiveSignupEvent);
    return () => window.removeEventListener("message", receiveSignupEvent);
  }, []);

  const finishSignup = useCallback(async (code: string) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 35_000);
    const response = await fetch("/api/crm/whatsapp/embedded-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, ...signupResult.current }),
      signal: controller.signal,
    }).finally(() => window.clearTimeout(timer));
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "No se pudo completar la conexión.");
    setState("connected");
    setMessage(`WhatsApp quedó conectado al CRM${data.displayPhoneNumber ? `: ${data.displayPhoneNumber}` : ""}.`);
  }, []);

  useEffect(() => {
    if (!authCode.current || !signupResult.current.wabaId || !signupResult.current.phoneNumberId || completing.current) return;
    completing.current = true;
    const code = authCode.current;
    setState("finishing");
    setMessage("Validando la autorización y guardando el número en el CRM…");
    void finishSignup(code).catch((error) => {
      setState("error");
      setMessage(error instanceof Error && error.name === "AbortError" ? "Meta tardó demasiado en responder. Volvé a intentar la conexión." : error instanceof Error ? error.message : "No se pudo completar la conexión.");
    }).finally(() => {
      authCode.current = "";
      completing.current = false;
    });
  }, [finishSignup, signupSignal]);

  function connect() {
    authCode.current = "";
    signupResult.current = {};
    completing.current = false;
    setMessage("");
    setState("opening");
    if (!window.FB) {
      setState("error");
      setMessage("Meta todavía está cargando. Esperá unos segundos y volvé a intentar.");
      return;
    }
    window.FB.login((response) => {
      const code = response.authResponse?.code;
      if (!code) {
        setState("idle");
        setMessage("La ventana se cerró sin completar la vinculación.");
        return;
      }
      authCode.current = code;
      setSignupSignal((value) => value + 1);
      setState("finishing");
      setMessage("Meta aprobó el acceso. Esperando la confirmación del número…");
    }, {
      config_id: CONFIG_ID,
      scope: "whatsapp_business_management,whatsapp_business_messaging",
      response_type: "code",
      override_default_response_type: true,
      extras: {
        setup: {},
        featureType: "whatsapp_business_app_onboarding",
        sessionInfoVersion: "3",
      },
    });
  }

  const busy = state === "opening" || state === "finishing";
  return (
    <section className="mb-4 border border-ink/12 bg-white px-5 py-4" aria-labelledby="whatsapp-connection-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><MessageCircle className="h-5 w-5" /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="whatsapp-connection-title" className="text-base font-semibold text-ink">Conectar WhatsApp Business</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-1 text-[11px] font-medium text-ink/65"><ShieldCheck className="h-3.5 w-3.5" />Solo administradores</span>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-ink/65">Vinculá el número oficial mediante Meta. WhatsApp Business seguirá funcionando en el teléfono y el historial disponible se conservará.</p>
            {message && <p role="status" className={`mt-2 text-sm font-medium ${state === "error" ? "text-red-700" : state === "connected" ? "text-emerald-700" : "text-ink/65"}`}>{message}</p>}
          </div>
        </div>
        <button type="button" onClick={connect} disabled={!sdkReady || busy || state === "connected"} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#006b6b] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#005858] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "connected" ? <CheckCircle2 className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
          {state === "connected" ? "Número conectado" : busy ? "Conectando…" : "Conectar con Meta"}
        </button>
      </div>
    </section>
  );
}

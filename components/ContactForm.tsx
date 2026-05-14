"use client";

import { useState, type FormEvent } from "react";

type Status = "idle" | "sending" | "ok" | "error";

const MIN_MESSAGE = 10;
const MAX_MESSAGE = 4000;

const INPUT_CLASS =
  "w-full px-4 py-3 text-base sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all";

const LABEL_CLASS = "block text-[11px] tracking-widest text-gray-500 uppercase mb-2";

export default function ContactForm() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const remaining = MAX_MESSAGE - mensaje.length;
  const messageTooShort = mensaje.trim().length > 0 && mensaje.trim().length < MIN_MESSAGE;
  const disabled = status === "sending";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled) return;
    setStatus("sending");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, asunto, mensaje, website }),
      });
      const data: { ok: boolean; error?: string } = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "No hemos podido enviar el mensaje. Inténtalo de nuevo.");
        return;
      }
      setStatus("ok");
      setNombre("");
      setEmail("");
      setAsunto("");
      setMensaje("");
      setWebsite("");
    } catch {
      setStatus("error");
      setErrorMsg("No hemos podido conectar con el servidor. Revisa tu conexión y prueba otra vez.");
    }
  }

  if (status === "ok") {
    return (
      <div className="bg-green-50 border border-green-100 text-green-900 rounded-2xl p-5 animate-fade-up">
        <p className="text-sm font-medium">Mensaje enviado.</p>
        <p className="mt-2 text-sm leading-relaxed text-green-900/80">
          Gracias por escribirnos. Te responderemos al correo que has indicado,
          normalmente en 1–3 días laborables.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-4 text-xs font-medium text-green-900 underline underline-offset-2 hover:no-underline"
        >
          Enviar otro mensaje
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {/* Honeypot: invisible para humanos, irresistible para bots. */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-10000px", width: "1px", height: "1px", overflow: "hidden" }}
      >
        <label htmlFor="contact-website">No rellenar</label>
        <input
          id="contact-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="contact-nombre" className={LABEL_CLASS}>
          Nombre
        </label>
        <input
          id="contact-nombre"
          type="text"
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          disabled={disabled}
          className={INPUT_CLASS}
          placeholder="Tu nombre"
        />
      </div>

      <div>
        <label htmlFor="contact-email" className={LABEL_CLASS}>
          Email
        </label>
        <input
          id="contact-email"
          type="email"
          required
          maxLength={120}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={disabled}
          className={INPUT_CLASS}
          placeholder="tucorreo@ejemplo.com"
        />
        <p className="mt-1.5 text-[11px] text-gray-400">
          Solo lo usamos para responderte. No te apuntamos a ninguna lista.
        </p>
      </div>

      <div>
        <label htmlFor="contact-asunto" className={LABEL_CLASS}>
          Asunto <span className="text-gray-300 normal-case tracking-normal">(opcional)</span>
        </label>
        <input
          id="contact-asunto"
          type="text"
          maxLength={140}
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
          disabled={disabled}
          className={INPUT_CLASS}
          placeholder="Corrección, sugerencia, retirada de datos…"
        />
      </div>

      <div>
        <label htmlFor="contact-mensaje" className={LABEL_CLASS}>
          Mensaje
        </label>
        <textarea
          id="contact-mensaje"
          required
          minLength={MIN_MESSAGE}
          maxLength={MAX_MESSAGE}
          rows={7}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          disabled={disabled}
          className={`${INPUT_CLASS} resize-y min-h-[160px]`}
          placeholder="Cuéntanos en qué podemos ayudarte. Si nos escribes por una corrección, indica el nombre del profesional o centro y la mutua."
        />
        <p className="mt-1.5 text-[11px] flex items-center justify-between">
          <span className={messageTooShort ? "text-amber-700" : "text-gray-400"}>
            {messageTooShort
              ? `Escribe al menos ${MIN_MESSAGE} caracteres.`
              : "Sé claro y conciso, nos ahorra ida y vuelta."}
          </span>
          <span className={remaining < 200 ? "text-amber-700" : "text-gray-400"}>{remaining}</span>
        </p>
      </div>

      {status === "error" && errorMsg && (
        <div className="bg-red-50 border border-red-100 text-red-800 rounded-xl px-4 py-3 text-sm animate-fade-up">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={disabled}
        className="w-full sm:w-auto self-start px-7 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 active:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {status === "sending" ? "Enviando…" : "Enviar mensaje"}
      </button>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Al enviar este formulario aceptas nuestra{" "}
        <a href="/privacidad" className="text-gray-500 hover:text-gray-700 underline underline-offset-2">
          política de privacidad
        </a>
        . No compartimos tu correo con nadie.
      </p>
    </form>
  );
}

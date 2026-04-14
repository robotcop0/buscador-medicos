"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const MUTUAS = [
  "Adeslas",
  "Allianz",
  "Asisa",
  "AXA Salud",
  "Caser Salud",
  "Cigna",
  "Divina Pastora",
  "DKV",
  "Fiatc",
  "Generali",
  "IMQ",
  "Mapfre",
  "Muface",
  "Occidente",
  "Sanitas",
  "Sin mutua",
];

const ESPECIALIDADES = [
  "Alergología",
  "Andrología",
  "Aparato digestivo",
  "Cardiología",
  "Cirugía general",
  "Cirugía plástica",
  "Dermatología",
  "Endocrinología",
  "Fisioterapia",
  "Ginecología",
  "Hematología",
  "Logopedia",
  "Medicina de urgencias",
  "Medicina estética",
  "Medicina general",
  "Medicina interna",
  "Nefrología",
  "Neumología",
  "Neurocirugía",
  "Neurología",
  "Nutrición y dietética",
  "Odontología",
  "Oftalmología",
  "Oncología",
  "Otorrinolaringología",
  "Pediatría",
  "Podología",
  "Psicología",
  "Psiquiatría",
  "Rehabilitación",
  "Reumatología",
  "Traumatología",
  "Urología",
];

const RADIOS = [
  { value: "2", label: "2 km" },
  { value: "10", label: "10 km" },
  { value: "25", label: "25 km" },
  { value: "50", label: "50 km" },
  { value: "100", label: "100 km" },
];

// Clases compartidas para selects e inputs dentro del pill bar (desktop)
const fieldBase =
  "w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 appearance-none focus:outline-none";

// Clases para el layout mobile (stacked)
const mobileInput =
  "w-full px-4 py-3 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 appearance-none focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all";

export default function SearchForm() {
  const router = useRouter();
  const [mutua, setMutua] = useState("");
  const [especialidad, setEspecialidad] = useState("");
  const [cp, setCp] = useState("");
  const [cpError, setCpError] = useState("");
  const [radio, setRadio] = useState("");

  function handleCpChange(value: string) {
    const clean = value.replace(/\D/g, "").slice(0, 5);
    setCp(clean);
    setCpError(clean.length > 0 && clean.length < 5 ? "5 dígitos" : "");
    if (clean.length < 5) setRadio("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (cp && cp.length !== 5) { setCpError("5 dígitos"); return; }
    const params = new URLSearchParams();
    if (mutua) params.set("mutua", mutua);
    if (especialidad) params.set("especialidad", especialidad);
    if (cp) params.set("cp", cp);
    if (cp && radio) params.set("radio", radio);
    router.push(`/resultados?${params.toString()}`);
  }

  const cpComplete = cp.length === 5;

  return (
    <form onSubmit={handleSubmit} noValidate>

      {/* ── DESKTOP: pill bar ── */}
      <div className="hidden sm:block">
        <div className="flex items-stretch bg-white border border-gray-200 rounded-2xl overflow-hidden transition-shadow focus-within:shadow-sm">

          {/* Mutua */}
          <div className="flex-1 px-5 py-4 border-r border-gray-100">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Mutua</p>
            <div className="relative">
              <select
                value={mutua}
                onChange={(e) => setMutua(e.target.value)}
                className={`${fieldBase} pr-4`}
                aria-label="Selecciona tu mutua"
              >
                <option value="">Cualquiera</option>
                {MUTUAS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDown />
            </div>
          </div>

          {/* Especialidad */}
          <div className="flex-1 px-5 py-4 border-r border-gray-100">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Especialidad</p>
            <div className="relative">
              <select
                value={especialidad}
                onChange={(e) => setEspecialidad(e.target.value)}
                className={`${fieldBase} pr-4`}
                aria-label="Selecciona la especialidad"
              >
                <option value="">Cualquiera</option>
                {ESPECIALIDADES.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              <ChevronDown />
            </div>
          </div>

          {/* Código postal */}
          <div className="w-36 px-5 py-4 border-r border-gray-100">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
              C. Postal{cpError && <span className="text-red-400 ml-1 normal-case">{cpError}</span>}
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={cp}
              onChange={(e) => handleCpChange(e.target.value)}
              placeholder="28001"
              className={`${fieldBase} ${cpError ? "text-red-500" : ""}`}
              aria-label="Código postal"
            />
          </div>

          {/* Buscar */}
          <button
            type="submit"
            className="px-7 bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 active:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            aria-label="Buscar médicos"
          >
            Buscar
          </button>
        </div>

        {/* Radio — aparece bajo la barra cuando el CP está completo */}
        {cpComplete && (
          <div className="mt-4 flex items-center gap-3 animate-fade-up">
            <span className="text-xs text-gray-400 whitespace-nowrap">Radio máximo</span>
            <div className="flex gap-1.5" role="group">
              {RADIOS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRadio(radio === value ? "" : value)}
                  className={`px-3 py-1 text-xs rounded-full border transition-all focus:outline-none ${
                    radio === value
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                  }`}
                  aria-pressed={radio === value}
                >
                  {label}
                </button>
              ))}
              {radio && (
                <button
                  type="button"
                  onClick={() => setRadio("")}
                  className="px-3 py-1 text-xs text-gray-400 hover:text-gray-600"
                >
                  Quitar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── MOBILE: stacked ── */}
      <div className="sm:hidden space-y-3">
        <div>
          <label htmlFor="mutua-m" className="block text-xs font-medium text-gray-500 mb-1">Mutua</label>
          <select id="mutua-m" value={mutua} onChange={(e) => setMutua(e.target.value)} className={mobileInput} aria-label="Mutua">
            <option value="">Cualquier mutua</option>
            {MUTUAS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="esp-m" className="block text-xs font-medium text-gray-500 mb-1">Especialidad</label>
          <select id="esp-m" value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} className={mobileInput} aria-label="Especialidad">
            <option value="">Cualquier especialidad</option>
            {ESPECIALIDADES.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="cp-m" className="block text-xs font-medium text-gray-500 mb-1">
            Código postal{cpError && <span className="text-red-400 ml-1">{cpError}</span>}
          </label>
          <input
            id="cp-m"
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={cp}
            onChange={(e) => handleCpChange(e.target.value)}
            placeholder="28001"
            className={`${mobileInput} ${cpError ? "border-red-300" : ""}`}
          />
        </div>

        {cpComplete && (
          <div className="animate-fade-up">
            <p className="text-xs font-medium text-gray-500 mb-1.5">Radio máximo</p>
            <div className="flex gap-1.5 flex-wrap">
              {RADIOS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRadio(radio === value ? "" : value)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                    radio === value
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-500 border-gray-200"
                  }`}
                  aria-pressed={radio === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-1">
          <button
            type="submit"
            className="w-full bg-gray-900 text-white text-sm font-medium py-3 rounded-xl hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
          >
            Buscar
          </button>
        </div>
      </div>

    </form>
  );
}

function ChevronDown() {
  return (
    <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2">
      <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

const AVAILABLE_MUTUAS = ["Adeslas", "Allianz", "AXA Salud", "Mapfre", "Sanitas"] as const;
const COMING_SOON_MUTUAS = [
  "Asisa",
  "Caser Salud",
  "Cigna",
  "Divina Pastora",
  "DKV",
  "Fiatc",
  "Generali",
  "IMQ",
  "Muface",
  "Occidente",
] as const;

type MutuaItem = { name: string; available: boolean };
const MUTUAS: MutuaItem[] = [
  ...AVAILABLE_MUTUAS.map((name) => ({ name, available: true })),
  ...COMING_SOON_MUTUAS.map((name) => ({ name, available: false })),
];

const RADIOS = [
  { value: "2", label: "2 km" },
  { value: "10", label: "10 km" },
  { value: "25", label: "25 km" },
  { value: "50", label: "50 km" },
  { value: "100", label: "100 km" },
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
    if (cp && cp.length !== 5) {
      setCpError("5 dígitos");
      return;
    }
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
      {/* ── DESKTOP ── */}
      <div className="hidden sm:block">
        <div className="flex items-stretch bg-white border border-gray-200 rounded-2xl overflow-visible transition-shadow focus-within:shadow-sm">
          {/* Mutua */}
          <div className="flex-1 px-5 py-3 border-r border-gray-100 min-w-0">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
              Mutua
            </p>
            <MutuaCombobox value={mutua} onChange={setMutua} />
          </div>

          {/* Especialidad */}
          <div className="flex-1 px-5 py-3 border-r border-gray-100 min-w-0">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
              Especialidad
            </p>
            <EspecialidadCombobox value={especialidad} onChange={setEspecialidad} />
          </div>

          {/* Código postal */}
          <div className="w-36 px-5 py-3 border-r border-gray-100">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
              C. Postal
              {cpError && <span className="text-red-400 ml-1 normal-case">{cpError}</span>}
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={cp}
              onChange={(e) => handleCpChange(e.target.value)}
              placeholder="28001"
              className={`w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none ${
                cpError ? "text-red-500" : ""
              }`}
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

      {/* ── MOBILE ── */}
      <div className="sm:hidden space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Mutua</label>
          <MutuaCombobox value={mutua} onChange={setMutua} mobile />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Especialidad</label>
          <EspecialidadCombobox value={especialidad} onChange={setEspecialidad} mobile />
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
            className={`w-full px-4 py-3 text-sm bg-white border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all ${
              cpError ? "border-red-300" : "border-gray-200"
            }`}
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

/* ---------------- Combobox components ---------------- */

type ComboboxProps = {
  value: string;
  onChange: (v: string) => void;
  mobile?: boolean;
};

function MutuaCombobox({ value, onChange, mobile }: ComboboxProps) {
  return (
    <Combobox
      value={value}
      onChange={onChange}
      placeholder={mobile ? "Cualquier mutua" : "Cualquiera"}
      options={MUTUAS.map((m) => ({
        value: m.name,
        label: m.name,
        disabled: !m.available,
        badge: m.available ? null : "En desarrollo",
      }))}
      mobile={mobile}
    />
  );
}

function EspecialidadCombobox({ value, onChange, mobile }: ComboboxProps) {
  return (
    <Combobox
      value={value}
      onChange={onChange}
      placeholder={mobile ? "Cualquier especialidad" : "Cualquiera"}
      options={ESPECIALIDADES.map((e) => ({ value: e, label: e }))}
      mobile={mobile}
    />
  );
}

type Option = {
  value: string;
  label: string;
  disabled?: boolean;
  badge?: string | null;
};

function Combobox({
  value,
  onChange,
  options,
  placeholder,
  mobile,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
  mobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const normalized = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const filtered = options.filter((o) =>
    o.label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .includes(normalized)
  );

  const selected = options.find((o) => o.value === value);

  // Lista unificada de índices navegables: 0 = placeholder ("Cualquiera"), 1..N = filtered.
  // Saltamos disabled al navegar.
  const totalItems = 1 + filtered.length;
  const isDisabled = (idx: number): boolean =>
    idx === 0 ? false : !!filtered[idx - 1]?.disabled;

  function moveHighlight(delta: number) {
    if (totalItems === 0) return;
    let next = highlight;
    for (let i = 0; i < totalItems; i++) {
      next = (next + delta + totalItems) % totalItems;
      if (!isDisabled(next)) {
        setHighlight(next);
        return;
      }
    }
  }

  // Al abrir o al cambiar query: reset al primer item habilitado.
  useEffect(() => {
    if (!open) return;
    let start = 0;
    while (start < totalItems && isDisabled(start)) start++;
    setHighlight(start < totalItems ? start : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  // Scroll al item resaltado cuando cambia.
  useEffect(() => {
    if (!open) return;
    itemRefs.current[highlight]?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function selectIndex(idx: number) {
    if (idx === 0) {
      onChange("");
    } else {
      const opt = filtered[idx - 1];
      if (!opt || opt.disabled) return;
      onChange(opt.value);
    }
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectIndex(highlight);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      triggerRef.current?.focus();
    }
  }

  function handleTriggerKeyDown(e: KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setOpen(true);
    }
  }

  const triggerBase = mobile
    ? "w-full px-4 py-3 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 flex items-center justify-between transition-all hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
    : "w-full bg-transparent text-sm text-gray-900 flex items-center justify-between focus:outline-none";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={triggerBase}
      >
        <span className={selected ? "text-gray-900 truncate" : "text-gray-400 truncate"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`h-3 w-3 flex-shrink-0 ml-2 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-2 w-full min-w-[260px] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden animate-fade-up ${
            mobile ? "" : "left-0"
          }`}
          style={{ maxHeight: 360 }}
        >
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar…"
              autoFocus
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-transparent rounded-lg focus:outline-none focus:bg-white focus:border-gray-200"
            />
          </div>
          <ul
            role="listbox"
            className="overflow-y-auto py-1"
            style={{ maxHeight: 5 * 36 }}
          >
            <li>
              <button
                ref={(el) => {
                  itemRefs.current[0] = el;
                }}
                type="button"
                role="option"
                aria-selected={highlight === 0}
                onMouseEnter={() => setHighlight(0)}
                onClick={() => selectIndex(0)}
                className={`w-full text-left px-4 py-2 text-sm ${
                  highlight === 0
                    ? "bg-gray-100 text-gray-900"
                    : value === ""
                    ? "text-gray-900 font-medium"
                    : "text-gray-500"
                }`}
              >
                {placeholder}
              </button>
            </li>
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-gray-400">Sin resultados</li>
            )}
            {filtered.map((o, i) => {
              const idx = i + 1;
              const isHighlighted = highlight === idx;
              return (
                <li key={o.value}>
                  <button
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isHighlighted}
                    disabled={o.disabled}
                    onMouseEnter={() => !o.disabled && setHighlight(idx)}
                    onClick={() => selectIndex(idx)}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between gap-3 transition-colors ${
                      o.disabled
                        ? "text-gray-300 cursor-not-allowed"
                        : isHighlighted
                        ? "bg-gray-100 text-gray-900 font-medium"
                        : value === o.value
                        ? "bg-gray-50 text-gray-900 font-medium"
                        : "text-gray-700"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {o.disabled && <ConstructionIcon />}
                      <span className="truncate">{o.label}</span>
                    </span>
                    {o.badge && (
                      <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {o.badge}
                      </span>
                    )}
                    {!o.badge && value === o.value && !o.disabled && !isHighlighted && <CheckIcon />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function ConstructionIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-amber-500 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-gray-900 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

"use client";

import { useState } from "react";

type Props = { q: string; a: string };

/**
 * Acordeón FAQ con animación suave (truco `grid-template-rows: 0fr → 1fr`, que
 * permite transición de altura sin conocer la altura final).
 */
export default function FAQItem({ q, a }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full py-5 flex items-start justify-between gap-4 text-left text-sm font-medium text-gray-900"
      >
        <span>{q}</span>
        <span
          aria-hidden
          className={`flex-shrink-0 mt-0.5 text-gray-400 transition-transform duration-300 text-lg leading-none ${open ? "rotate-45" : ""}`}
        >
          +
        </span>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <p className="pb-5 -mt-1 text-sm text-gray-600 leading-relaxed pr-8">{a}</p>
        </div>
      </div>
    </li>
  );
}

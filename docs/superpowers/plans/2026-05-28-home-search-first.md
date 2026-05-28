# Home con buscador manual primero, chatbot en FAB — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invertir la jerarquía de la home: `<SearchForm />` pasa al hero y `<ChatWidget />` queda accesible vía un botón flotante (FAB) anclado abajo-derecha en `/` y `/resultados`. Borrar la ruta `/manual` redundante.

**Architecture:** Un componente nuevo `ChatLauncher` (cliente) envuelve `ChatWidget` en un panel anclado, controlado por un FAB. `ChatWidget` gana una prop `variant: "hero" | "panel"` para alternar dimensionado fijo vs flex-fill. Se monta explícitamente en home y `/resultados` (sin gating en layout).

**Tech Stack:** Next.js 16 App Router, React client components, Tailwind CSS, TypeScript.

**Verificación:** El proyecto no tiene test runner (`CLAUDE.md`: "No test runner is configured"). Cada cambio se verifica con (a) TypeScript compile vía `npm run build` (o el dev server captando errores de tipo en HMR) y (b) smoke test visual con `curl` + checklist manual en navegador. El dev server ya está corriendo en background en :3001 (id `bozva7z57`) — `curl` directo a esa URL es suficiente para confirmar 200; los checks visuales los hace el usuario o el agente con screenshot tooling si está disponible.

**Spec:** `docs/superpowers/specs/2026-05-28-home-search-first-design.md`

---

## Mapa de archivos

| Acción | Archivo | Responsabilidad |
|---|---|---|
| Modificar | `components/ChatWidget.tsx` | Acepta `variant?: "hero" \| "panel"`, alterna dimensionado del scroll container y de la propia raíz |
| Crear | `components/ChatLauncher.tsx` | FAB + panel anclado abajo-derecha. Estado open/closed, listener Esc, focus management. Monta `ChatWidget` con `variant="panel"` |
| Modificar | `app/page.tsx` | Hero pasa de `<ChatWidget />` a `<SearchForm />`, copy actualizado, monta `<ChatLauncher />` al final del main |
| Modificar | `app/resultados/page.tsx` | Monta `<ChatLauncher />` al final del main |
| Modificar | `app/sitemap.ts` | Elimina la entrada `/manual` |
| Borrar | `app/manual/page.tsx` + dir | Ruta redundante; visitas devuelven 404 nativo |
| Modificar | `CLAUDE.md` | Sección "Chatbot asistente (home)" reescrita para reflejar la nueva arquitectura |

---

### Task 1: ChatWidget acepta `variant` para flex-fill en panel

**Files:**
- Modify: `components/ChatWidget.tsx` (props interface; raíz; scroll container; form)

- [ ] **Step 1: Localizar la firma actual del componente**

Lee `components/ChatWidget.tsx` y busca la línea donde se exporta el componente. Hoy es `export default function ChatWidget()` (sin props). El componente vive aproximadamente entre las líneas 75–356.

- [ ] **Step 2: Añadir la prop `variant`**

Sustituye la firma:

```tsx
export default function ChatWidget() {
```

por:

```tsx
type ChatWidgetProps = {
  variant?: "hero" | "panel";
};

export default function ChatWidget({ variant = "hero" }: ChatWidgetProps) {
```

- [ ] **Step 3: Cambiar la raíz para soportar flex-fill en panel**

En el `return (...)`, hoy es:

```tsx
return (
  <div>
    {/* Mensajes — sin caja: fluyen sobre el fondo de la página */}
    <div ref={scrollRef} className="min-h-[34rem] max-h-[82vh] sm:max-h-[54rem] overflow-y-auto pr-1 space-y-5">
```

Cambiar a:

```tsx
return (
  <div className={variant === "panel" ? "flex flex-col h-full" : ""}>
    {/* Mensajes — sin caja: fluyen sobre el fondo de la página */}
    <div
      ref={scrollRef}
      className={
        variant === "panel"
          ? "flex-1 min-h-0 overflow-y-auto pr-1 space-y-5"
          : "min-h-[34rem] max-h-[82vh] sm:max-h-[54rem] overflow-y-auto pr-1 space-y-5"
      }
    >
```

(`min-h-0` en el panel es necesario para que `flex-1` permita scroll dentro de un flex-column — sin él el contenido fuerza al contenedor a crecer.)

- [ ] **Step 4: Marcar el form como flex-shrink-0 en panel**

El form de input está hacia la línea 333–354. Hoy:

```tsx
<form
  onSubmit={submitText}
  className="mt-5 flex items-center gap-2 rounded-full border border-gray-300 bg-transparent pl-5 pr-1.5 py-1.5 transition-colors focus-within:border-gray-500"
>
```

Cambiar a:

```tsx
<form
  onSubmit={submitText}
  className={`${variant === "panel" ? "mt-3 flex-shrink-0" : "mt-5"} flex items-center gap-2 rounded-full border border-gray-300 bg-transparent pl-5 pr-1.5 py-1.5 transition-colors focus-within:border-gray-500`}
>
```

- [ ] **Step 5: Verificar que TypeScript compila**

Run: `npx tsc --noEmit`
Expected: exit 0, sin errores nuevos.

- [ ] **Step 6: Verificar que la home sigue funcionando**

La home sigue montando `<ChatWidget />` sin prop, por lo que `variant` se defaulta a `"hero"` y el render debe ser idéntico al anterior.

Run: `curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001/`
Expected: `HTTP 200`

Y visualmente: abrir `http://localhost:3001/` en navegador y comprobar que el ChatWidget se ve exactamente como antes (mismo alto, mismo input, misma conversación).

- [ ] **Step 7: Commit**

```bash
git add components/ChatWidget.tsx
git commit -m "$(cat <<'EOF'
ChatWidget: prop variant para soportar render embebido en panel

Añade variant?: "hero" | "panel" (default "hero", retrocompatible). En
modo panel la raíz pasa a flex column h-full y el scroll container a
flex-1 min-h-0, para que el widget llene el alto fijo del contenedor
padre que lo monte.
EOF
)"
```

---

### Task 2: Crear ChatLauncher (FAB + panel anclado)

**Files:**
- Create: `components/ChatLauncher.tsx`

- [ ] **Step 1: Crear el archivo con el componente completo**

Crear `components/ChatLauncher.tsx` con este contenido exacto:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import ChatWidget from "./ChatWidget";

export default function ChatLauncher() {
  const [open, setOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Cerrar con Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        // El foco vuelve al FAB tras el re-render (botón vuelve a ser visible)
        requestAnimationFrame(() => fabRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Al abrir, mover foco al input del chat
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const input = panelRef.current?.querySelector<HTMLInputElement>(
        'input[aria-label="Escribe tu mensaje"]'
      );
      input?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => fabRef.current?.focus());
  }

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir asistente"
        aria-expanded={open}
        className={`fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gray-900 text-white shadow-lg flex items-center justify-center transition-all hover:bg-gray-800 hover:-translate-y-0.5 ${
          open ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.84L3 20l1.05-3.5A7.94 7.94 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Asistente"
          className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col
                     bottom-20 right-4 w-[calc(100vw-2rem)] h-[calc(100vh-6rem)]
                     sm:bottom-24 sm:right-6 sm:w-[400px] sm:h-[600px]
                     sm:max-w-[calc(100vw-3rem)] sm:max-h-[calc(100vh-8rem)]"
        >
          <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-900">Asistente</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar asistente"
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </header>
          <div className="flex-1 min-h-0 overflow-hidden p-3">
            <ChatWidget variant="panel" />
          </div>
        </div>
      )}
    </>
  );
}
```

Notas de diseño relevantes:
- El FAB se vuelve `opacity-0 pointer-events-none` mientras el panel está abierto: no compite visualmente con la × del header, y los clicks no se bloquean.
- El panel no tiene overlay oscuro ni focus trap (decisión explícita del spec: no-modal).
- Esc cierra y devuelve el foco al FAB. La × también.
- Al abrir, el foco va al `<input aria-label="Escribe tu mensaje">` del ChatWidget — el selector está acotado al panel (`panelRef.current?.querySelector(...)`) para no pillar inputs ajenos.

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/ChatLauncher.tsx
git commit -m "$(cat <<'EOF'
ChatLauncher: FAB + panel anclado abajo-derecha

Componente cliente que envuelve ChatWidget en variant="panel". FAB
redondo fijo en bottom-6 right-6; al pulsar abre un panel 400×600 (en
desktop) / casi-fullscreen (móvil) anclado a la misma esquina. Cierra
con × o Esc, devuelve foco al FAB. No bloquea la página (no-modal).
EOF
)"
```

---

### Task 3: Home: SearchForm al hero + montar ChatLauncher

**Files:**
- Modify: `app/page.tsx` (imports; header copy; hero body; mount Launcher)

- [ ] **Step 1: Actualizar imports**

En `app/page.tsx`, los imports actuales (líneas 1–7) incluyen `ChatWidget`. Sustituir:

```tsx
import ChatWidget from "@/components/ChatWidget";
```

por:

```tsx
import SearchForm from "@/components/SearchForm";
import ChatLauncher from "@/components/ChatLauncher";
```

El orden recomendado del bloque de imports queda:

```tsx
import Link from "next/link";
import SearchForm from "@/components/SearchForm";
import ChatLauncher from "@/components/ChatLauncher";
import ContactForm from "@/components/ContactForm";
import SiteFooter from "@/components/SiteFooter";
import Reveal from "@/components/Reveal";
import FAQItem from "@/components/FAQItem";
import { MUTUAS, ESPECIALIDADES } from "@/lib/slugs";
```

- [ ] **Step 2: Actualizar el subtítulo del hero**

En el `<header>` del hero (líneas 129–137 actuales), hoy:

```tsx
<header className="mb-5 sm:mb-7">
  <h1 className="text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight text-gray-900">
    <span className="font-light">Encuentra </span>
    <span className="font-bold">tu mejor médico.</span>
  </h1>
  <p className="mt-3 text-sm text-gray-400 font-light">
    Búsqueda en tiempo real en toda España.
  </p>
</header>
```

Cambiar el `<p>` por:

```tsx
<p className="mt-3 text-sm text-gray-400 font-light">
  Selecciona mutua, especialidad y código postal.{" "}
  <span className="hidden sm:inline">
    ¿Prefieres preguntar en lenguaje natural? Usa el asistente ↘
  </span>
</p>
```

(El "↘" remite al FAB de abajo-derecha. Se oculta en móvil porque el FAB ya está visible en pantalla y el texto se haría largo.)

- [ ] **Step 3: Sustituir `<ChatWidget />` por `<SearchForm />`**

En el hero (línea 139 actual), sustituir:

```tsx
<ChatWidget />
```

por:

```tsx
<SearchForm />
```

- [ ] **Step 4: Montar `<ChatLauncher />` al final del `<main>`**

Justo antes del cierre `</main>` (línea 341 actual), añadir:

```tsx
<ChatLauncher />
```

El JSX final del cierre debe quedar:

```tsx
      <SiteFooter />
      <ChatLauncher />
    </main>
```

- [ ] **Step 5: Verificar build**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Smoke test de la home**

Run: `curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001/`
Expected: `HTTP 200`

Verificación visual en navegador (`http://localhost:3001/`):
1. El hero muestra el `SearchForm` (mutua, especialidad, CP, radio, botón "Buscar").
2. El subtítulo dice "Selecciona mutua, especialidad y código postal. ¿Prefieres preguntar en lenguaje natural? Usa el asistente ↘".
3. Hay un botón redondo negro abajo-derecha (FAB).
4. Click en el FAB → panel abre desde abajo-derecha con el chat dentro.
5. Click en × → panel cierra, foco vuelve al FAB.
6. Pulsar Esc con panel abierto → cierra.
7. El resto de secciones (Qué es, Mutuas, Especialidades, etc.) siguen renderizando bien al scrollear.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "$(cat <<'EOF'
Home: SearchForm al hero, ChatLauncher como FAB

Invierte la jerarquía del primer fold: el buscador manual pasa a ser la
acción primaria y el chatbot queda accesible vía botón flotante abajo-
derecha. Subtítulo del hero remite al FAB con un "↘". Resto de
secciones (Qué es, Mutuas, etc.) sin tocar.
EOF
)"
```

---

### Task 4: Montar ChatLauncher en /resultados

**Files:**
- Modify: `app/resultados/page.tsx` (import + mount)

- [ ] **Step 1: Localizar imports y cierre del main**

Lee `app/resultados/page.tsx`. Localiza el bloque de imports al inicio y el cierre `</main>` al final del `return`.

- [ ] **Step 2: Añadir import**

Añadir junto al resto de imports de componentes:

```tsx
import ChatLauncher from "@/components/ChatLauncher";
```

- [ ] **Step 3: Montar `<ChatLauncher />` antes del cierre del `<main>`**

Insertar `<ChatLauncher />` justo antes de `</main>` (independientemente de si hay `<SiteFooter />` u otros componentes ahí — el orden importa poco porque el Launcher es `position: fixed`).

Ejemplo:

```tsx
      {/* ... resto del JSX existente ... */}
      <ChatLauncher />
    </main>
```

- [ ] **Step 4: Verificar build**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Smoke test de /resultados**

Run: `curl -s -o /dev/null -w "HTTP %{http_code}\n" 'http://localhost:3001/resultados?mutua=Adeslas&especialidad=Cardiolog%C3%ADa&cp=28001'`
Expected: `HTTP 200`

Verificación visual:
1. La página de resultados carga normal (listado de médicos, paginación).
2. FAB visible abajo-derecha.
3. Abrir FAB → panel con chat.
4. **Persistencia entre páginas:** abrir el FAB en `/`, escribir un mensaje y enviarlo, esperar respuesta. Navegar a `/resultados?...`. Abrir el FAB → la conversación previa sigue ahí (viene de `sessionStorage`).

- [ ] **Step 6: Commit**

```bash
git add app/resultados/page.tsx
git commit -m "$(cat <<'EOF'
Resultados: monta ChatLauncher

El FAB del chatbot también aparece en /resultados, conservando la
conversación de la home vía sessionStorage del ChatWidget.
EOF
)"
```

---

### Task 5: Borrar /manual y limpiar sitemap

**Files:**
- Delete: `app/manual/page.tsx` y el directorio `app/manual/`
- Modify: `app/sitemap.ts` (línea 24)

- [ ] **Step 1: Borrar el directorio /manual**

Run: `rm -rf /Users/javi/buscador-medicos/app/manual`

- [ ] **Step 2: Confirmar el borrado**

Run: `ls /Users/javi/buscador-medicos/app/manual 2>&1`
Expected: `ls: ... No such file or directory`

- [ ] **Step 3: Quitar la entrada `/manual` del sitemap**

Lee `app/sitemap.ts` y localiza el objeto cuyo `url` es `` `${SITE_URL}/manual` `` (línea 24 actual). Bórralo completo (el objeto entero, incluidas las llaves y la coma).

Antes (ejemplo del bloque, ajustar a lo que esté exactamente):

```ts
    {
      url: `${SITE_URL}/manual`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.7,
    },
```

Después: línea eliminada.

- [ ] **Step 4: Verificar TS**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Smoke test**

Run: `curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001/manual`
Expected: `HTTP 404`

Run: `curl -s http://localhost:3001/sitemap.xml | grep -c "/manual" || echo 0`
Expected: `0` (ninguna ocurrencia de `/manual` en el sitemap).

- [ ] **Step 6: Verificar que no quedan referencias internas**

Run: `grep -rn "/manual\|app/manual" app components lib 2>/dev/null | grep -v node_modules`
Expected: vacío (ninguna salida).

- [ ] **Step 7: Commit**

```bash
git add -A app/manual app/sitemap.ts
git commit -m "$(cat <<'EOF'
Borra ruta /manual y la quita del sitemap

La home pasa a montar SearchForm en el hero, así que /manual quedaba
duplicada. Visitas legacy devuelven 404 nativo de Next.
EOF
)"
```

---

### Task 6: Actualizar CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (sección "Chatbot asistente (home)")

- [ ] **Step 1: Leer la sección actual**

Lee `CLAUDE.md` y localiza la sección que empieza con `### Chatbot asistente (home)`. Esta sección describe que el chat ES el primer fold y el buscador manual vive en `/manual` — ambas cosas dejan de ser ciertas.

- [ ] **Step 2: Reescribir la sección**

Sustituir el bloque completo de "### Chatbot asistente (home)" (encabezado + párrafos descriptivos) por:

```markdown
### Chatbot asistente

**El buscador manual ES el primer fold de la home** (`app/page.tsx` → `<SearchForm />`): selecciona mutua, especialidad y código postal de toda la vida. El chatbot vive en un **botón flotante (FAB)** anclado abajo-derecha que abre un panel ~400×600 px (en desktop) o casi-fullscreen (móvil) con el `ChatWidget`. El componente `components/ChatLauncher.tsx` monta el FAB + panel y se incluye explícitamente en `app/page.tsx` y `app/resultados/page.tsx` (no en blog, legales, sobre, contacto ni en las páginas de programmatic SEO).

El usuario pregunta en lenguaje natural ("el mejor cardiólogo de Adeslas cerca del 28013"); el bot pide los datos que falten con **botones (chips)** y devuelve un top 3–5 de médicos en Markdown + enlace a `/resultados` con los filtros ya aplicados. Es opcional: sin `ANTHROPIC_API_KEY` el widget muestra "asistente no disponible" y nada más se rompe.

La conversación persiste en `sessionStorage` (clave gestionada por `ChatWidget`), así que cerrar el panel o navegar entre `/` y `/resultados` conserva el hilo. El `ChatWidget` acepta `variant?: "hero" | "panel"`; hoy solo se usa `"panel"` (el `"hero"` queda como default retrocompatible por si en el futuro se vuelve a montar inline).

La ruta `/manual` (que en su día albergaba el buscador standalone) **se ha eliminado**: la home ya cubre ese caso de uso.
```

(Si la sección original incluía más detalle técnico — endpoints, modelo, tool flow — preservar esos párrafos y solo reemplazar la primera frase que ubicaba el chat como primer fold y el manual en `/manual`.)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: CLAUDE.md refleja nueva home (SearchForm hero + FAB)

Sección "Chatbot asistente" reescrita: el primer fold ahora es el
buscador manual, el chatbot vive en un FAB en home y /resultados, y la
ruta /manual desaparece.
EOF
)"
```

---

### Task 7: Build de producción + checklist final

**Files:** ninguno (verificación)

- [ ] **Step 1: Build de producción**

Run: `npm run build 2>&1 | tail -30`
Expected: build OK, sin errores TS, sin errores de rutas. Comprobar que `/manual` no aparece en la lista de rutas generadas.

- [ ] **Step 2: Smoke tests con dev server (sigue corriendo en :3001)**

Run en paralelo:

```bash
curl -s -o /dev/null -w "/ %{http_code}\n" http://localhost:3001/
curl -s -o /dev/null -w "/resultados %{http_code}\n" 'http://localhost:3001/resultados?mutua=Adeslas&especialidad=Cardiolog%C3%ADa&cp=28001'
curl -s -o /dev/null -w "/manual %{http_code}\n" http://localhost:3001/manual
curl -s -o /dev/null -w "/blog %{http_code}\n" http://localhost:3001/blog
curl -s -o /dev/null -w "/sitemap.xml %{http_code}\n" http://localhost:3001/sitemap.xml
```

Expected:
```
/ 200
/resultados 200
/manual 404
/blog 200
/sitemap.xml 200
```

- [ ] **Step 3: Checklist visual (humano)**

Pedir al usuario que abra el navegador y confirme:

1. `/` muestra `SearchForm` en el hero (mutua/especialidad/CP), FAB abajo-derecha.
2. FAB → panel se abre, × y Esc cierran, foco vuelve al FAB al cerrar.
3. Escribir en el chat funciona; al recibir respuesta, el panel hace scroll dentro de su propia altura (no de la página).
4. Navegar a `/resultados?...`: FAB sigue ahí, conversación persiste al reabrir.
5. `/blog`, `/contacto`, `/sobre`, `/cuadro-medico/adeslas`, `/medicos/cardiologia` — **NO** muestran FAB.
6. En móvil (devtools ≤420px): panel ocupa casi toda la pantalla, sigue siendo usable.
7. No hay errores en consola.

- [ ] **Step 4: Commit final si hay cambios**

Si los pasos previos requirieron ajustes (clases responsive, copy, etc.), hacer un commit final descriptivo. Si no, no hay commit que hacer en este task.

---

## Self-Review

**Cobertura del spec:**
- ✅ Buscador manual al hero de la home → Task 3
- ✅ ChatLauncher FAB + panel anclado → Task 2
- ✅ Scope FAB solo en `/` y `/resultados` → Tasks 3 + 4 (no se monta en ningún otro sitio)
- ✅ `/manual` borrado → Task 5
- ✅ Conversación persistente → reutiliza `sessionStorage` existente de `ChatWidget` (no necesita task)
- ✅ ChatWidget refactor con `variant` → Task 1
- ✅ Sitemap limpio → Task 5
- ✅ `CLAUDE.md` actualizado → Task 6
- ✅ Verificación final (build + checklist) → Task 7

**Placeholders:** ninguno.

**Consistencia de tipos:** la prop se llama `variant` y el valor `"panel"` en todas las tasks (1, 2, 6). El selector de foco usa `'input[aria-label="Escribe tu mensaje"]'` que coincide con `aria-label="Escribe tu mensaje"` ya presente en `ChatWidget.tsx:344`.

**Ambigüedad detectada y resuelta:** El spec original decía "cambiar sólo la línea 229" para el variant. Esto era insuficiente — `h-full` dentro de un padre auto-sized colapsa a 0. El plan corrige: la raíz pasa a `flex flex-col h-full` en panel, el scroll a `flex-1 min-h-0`, y el form a `flex-shrink-0`. Cambio mínimo pero necesario para que el panel funcione.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-28-home-search-first.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

# Home: buscador manual primero, chatbot en FAB

**Fecha:** 2026-05-28
**Estado:** aprobado, pendiente de plan de implementación

## Contexto

Tras el último merge desde `origin/main` la home arranca con `<ChatWidget />` ocupando el primer fold y el buscador manual vive en `/manual`. El usuario quiere invertir la jerarquía: el buscador manual debe ser el primer plano (es el caso de uso por defecto) y el chatbot debe quedar accesible para quien quiera una atención más conversacional, sin competir visualmente.

## Decisiones

- **Buscador manual al hero de la home.** `<SearchForm />` ocupa el primer fold de `/`. El resto de secciones marketing (Qué es, Mutuas, Especialidades, Cómo funciona, FAQ, Contacto) se mantienen tal cual debajo.
- **Chatbot como FAB anclado abajo-derecha.** Botón flotante siempre visible que, al pulsar, abre un panel ~400×600px anclado a la misma esquina (estilo Intercom). Sin overlay oscuro: la página sigue interactiva detrás del panel.
- **Scope del FAB:** sólo en `/` y `/resultados`. No aparece en blog, legales, sobre, contacto ni en las páginas de programmatic SEO (`/cuadro-medico/*`, `/medicos/*`).
- **`/manual` se borra.** La ruta queda redundante y produciría duplicate content. 404 nativo de Next para visitas legacy (no se redirige).
- **Conversación persistente.** Se reutiliza el `sessionStorage` existente del `ChatWidget`. Cambiar de `/` a `/resultados` y reabrir el FAB conserva el hilo; cerrar y reabrir el panel también.

## Componentes y archivos

### Nuevo: `components/ChatLauncher.tsx`

Client component (`"use client"`). Estado local `open: boolean` (inicial `false`).

**FAB:**
- `position: fixed`, `bottom-6 right-6`, `z-50`.
- Botón redondo 56px, fondo `bg-gray-900`, icono chat reutilizado del SVG ya presente en `ChatWidget`.
- Hover: `translate-y-0.5` + ligeramente más oscuro.
- `aria-label="Abrir asistente"`.

**Panel (cuando `open === true`):**
- `position: fixed`, `bottom-24 right-6`.
- Tamaño desktop (≥640px): `w-[400px] h-[600px]`, recortado por `max-w-[calc(100vw-3rem)]` y `max-h-[calc(100vh-8rem)]`.
- Tamaño móvil (<640px): `w-[calc(100vw-2rem)] h-[calc(100vh-6rem)]`, anclado `bottom-20 right-4` (más cerca de los bordes y deja espacio justo arriba del FAB). Esto permite aprovechar prácticamente toda la pantalla en móvil.
- Fondo blanco, `rounded-2xl`, sombra (`shadow-xl` o similar), borde sutil.
- Header con título "Asistente" + botón cerrar (×).
- Contenido: `<ChatWidget variant="panel" />`.

**Interacciones:**
- Cierre con × o tecla `Esc` (listener global registrado sólo mientras `open === true`, desmontado al cerrar).
- Al abrir, mueve foco al textarea del chat. Al cerrar, lo devuelve al FAB.
- No bloquea la página: sin overlay, sin `aria-modal`, sin focus trap.

### Modificado: `components/ChatWidget.tsx`

Añadir prop opcional `variant?: "hero" | "panel"` (default `"hero"`, retrocompatible).

Único cambio funcional: la clase del scroll container (línea 229 actual).

Antes:
```tsx
<div ref={scrollRef} className="min-h-[34rem] max-h-[82vh] sm:max-h-[54rem] overflow-y-auto pr-1 space-y-5">
```

Después:
```tsx
<div
  ref={scrollRef}
  className={
    variant === "panel"
      ? "h-full overflow-y-auto pr-1 space-y-5"
      : "min-h-[34rem] max-h-[82vh] sm:max-h-[54rem] overflow-y-auto pr-1 space-y-5"
  }
>
```

En modo `panel` el contenedor llena verticalmente el panel del Launcher (que ya fija altura). En modo `hero` queda exactamente como hoy.

Resto intacto: lógica de mensajes, tool calls, `sessionStorage`, markdown, chips, welcome message.

### Modificado: `app/page.tsx`

- Reemplazar `<ChatWidget />` (línea 139) por `<SearchForm />`.
- Importar `SearchForm` desde `@/components/SearchForm`.
- Actualizar el copy del hero. El subtítulo actual ("Búsqueda en tiempo real en toda España.") se sustituye por:
  > Selecciona mutua, especialidad y código postal.
  > ¿Prefieres preguntar en lenguaje natural? Usa el asistente ↘
- Montar `<ChatLauncher />` al final del `<main>` (es `fixed`, así que la posición en el árbol DOM no afecta visualmente, pero por orden semántico va al final).
- Quitar el import de `ChatWidget`.

### Modificado: `app/resultados/page.tsx`

- Importar `ChatLauncher` desde `@/components/ChatLauncher`.
- Montar `<ChatLauncher />` al final del `<main>` (antes o después de la paginación, da igual — es `fixed`).
- Sin cambios en la lógica SSR del listado.

### Modificado: `app/sitemap.ts`

Eliminar la entrada `/manual` (línea 24 actual).

### Borrado: `app/manual/page.tsx` y directorio `app/manual/`

Borrado completo. Cualquier visita devuelve 404 nativo de Next.

### Modificado: `CLAUDE.md`

Sección "Chatbot asistente (home)" — reescribirla para reflejar:
- El **buscador manual ES el primer fold** de la home (`<SearchForm />` en `app/page.tsx`).
- El chatbot vive en un **FAB abajo-derecha** que abre un panel anclado (componente `ChatLauncher.tsx`).
- El FAB se monta sólo en `/` y `/resultados`.
- La ruta `/manual` ya no existe.

## Flujo de datos

Sin cambios. El `ChatLauncher` no introduce nuevo estado global: el `ChatWidget` ya persiste mensajes y `apiMessages` en `sessionStorage`, y el cambio de variante no toca esa lógica. Una conversación iniciada en home aparece intacta al abrir el FAB en `/resultados`.

## Verificación tras implementación

1. `/` muestra `SearchForm` en el hero, FAB visible abajo-derecha.
2. Pulsar el FAB abre el panel anclado, cierra con × y con `Esc`.
3. `/resultados?...` también muestra el FAB y la conversación persiste entre páginas.
4. `/manual` devuelve 404.
5. El sitemap (`/sitemap.xml`) ya no lista `/manual`.
6. El FAB no choca con ningún elemento `fixed` existente en `/resultados` (no debería haber ninguno, pero confirmar visualmente).
7. En móvil (≤420px) el panel sigue siendo usable: altura suficiente, no se sale de pantalla.
8. La home no rompe en SSR (las páginas `cuadro-medico` y `medicos` no se ven afectadas).

## No alcance

- No se rediseña el `ChatWidget` por dentro (markdown, chips, tool calls — todo igual).
- No se introduce overlay oscuro, focus trap ni `aria-modal`: el panel es no-modal por decisión explícita.
- No se redirige `/manual` con 301 ni se mantiene canonical: la página simplemente desaparece.
- No se añade FAB en blog, legales, sobre, contacto ni en las páginas de programmatic SEO.

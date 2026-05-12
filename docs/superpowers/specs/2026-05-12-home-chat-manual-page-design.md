# Home = chat de IA + página `/manual` con el buscador clásico — diseño

Fecha: 2026-05-12
Estado: aprobado

## Objetivo

Reorganizar la portada: el primer fold de la home deja de ser el formulario de búsqueda
y pasa a ser **el chatbot de IA**, abierto, grande y con un acabado más cuidado. El
buscador manual de siempre se mueve a una página propia **`/manual`**. El resto de la
home (secciones "Qué es" / "Mutuas cubiertas" / "Especialidades" / "Cómo funciona" / "FAQ"
+ footer) se mantiene tal cual debajo del chat — no se pierde nada de SEO (FAQ schema,
enlaces internos a las ~1000 páginas programáticas).

## Decisiones

- **Secciones de la home**: se mantienen debajo del chat, sin cambios.
- **Chat en la home**: siempre abierto (sin barra de plegar), más grande, con mensaje de
  bienvenida + **3-4 chips de sugerencia** que aparecen solo cuando la conversación está
  vacía (solo el saludo). Polish dentro de la estética gris/minimalista existente — no se
  introduce paleta cálida ni serifa.
- **`ChatWidget`** se reescribe a esta versión "hero" (siempre abierto, grande, chips,
  polish). La lógica de conversación / tools / `localStorage` / API **no cambia**.
- **Branch**: se sigue en `feat/chatbot-asistente` (continuación natural del trabajo del
  chatbot).

## Componentes y ficheros

### Nuevos
- `app/manual/page.tsx` — server component. Estructura tipo hero standalone:
  - Eyebrow: "Buscador de Médicos · Buscador manual" (o similar).
  - `<h1>` corto, p.ej. "Buscador manual".
  - El `<SearchForm />` actual, sin modificar.
  - Enlace de vuelta a la home: "¿Prefieres preguntarle a nuestro asistente? → /".
  - `<SiteFooter />`.
  - `export const metadata` con `title` / `description` propios.
  - Sin FAQ ni el resto de secciones de la home.

### Modificados
- `app/page.tsx`:
  - Quitar `import SearchForm` del hero (sigue importándose donde haga falta — no, en la
    home solo se usaba en el hero, así que se quita el import). Mantener `<ChatWidget />`.
  - Eyebrow row: añadir el enlace "Buscador manual" (`/manual`) junto al ya existente
    "Blog".
  - `<h1>` "Encuentra tu mejor médico." con subtítulo retocado, p.ej. *"Pregúntale a
    nuestro asistente — o usa el [buscador manual](/manual)."*.
  - El hero pasa a contener el chat protagonista (vía `<ChatWidget />`, ya con su nuevo
    layout). Quitar el `min-h-screen` del `<section>` si el chat grande ya llena bien el
    fold, o dejarlo — decisión menor de implementación; preferible mantener un hero
    cómodo pero sin forzar pantalla completa rígida.
  - Secciones "Qué es" / "Mutuas cubiertas" / "Especialidades" / "Cómo funciona" / "FAQ"
    / `<SiteFooter />`: **sin cambios**.
- `components/ChatWidget.tsx` — nuevo layout "hero":
  - Sin estado `open` (siempre visible) ni botón de plegar; en su lugar una **cabecera
    decorativa**: "Asistente · Buscador de Médicos" con un puntito verde (`bg-emerald-500`,
    pequeño) a la izquierda.
  - Panel: `rounded-3xl border border-gray-200 bg-white shadow-sm` (más presencia que el
    `rounded-2xl` actual).
  - Burbujas del asistente: avatar pequeño (emoji 🩺 en un círculo gris) a la izquierda.
  - Indicador "pensando": tres puntos con animación de pulso (clases Tailwind
    `animate-pulse` escalonadas, o reutilizar/añadir un keyframe simple en `globals.css`
    si hace falta — preferir solo Tailwind).
  - **Chips de sugerencia**: cuando `display.length === 1` (solo el saludo) y `!loading`,
    debajo del saludo se muestra una fila de 3-4 botones pill outline con prompts de
    ejemplo. Al pulsar uno → se envía como mensaje de usuario (misma ruta que `submitText`
    con ese texto). Prompts: "El mejor cardiólogo de Adeslas en el 28001", "Dermatólogo de
    Sanitas en Valencia", "Pediatra de DKV cerca de Sevilla", "Traumatólogo de Adeslas en
    Barcelona".
  - Altura: la zona de mensajes algo más alta que la actual (`min-h-[24rem] max-h-[70vh]
    sm:max-h-[40rem]`, ajustable).
  - Resto (input, pie con disclaimer + "Reiniciar", persistencia, fetch a `/api/chat`,
    manejo de `pendingSelection`/chips de selección, Markdown): **igual que ahora**.
- `app/sitemap.ts` — añadir `/manual` a la lista de URLs (junto a `home` / `legales`).
- `CLAUDE.md` — en la sección "Chatbot asistente (home)" y/o "Search form": anotar que la
  home es ahora el chat (hero), que el buscador manual vive en `app/manual/page.tsx`, y
  que el `ChatWidget` ya no es plegable (layout "hero" con chips de sugerencia).

## No se toca
- `components/SearchForm.tsx` (incluido su prop `compact`).
- `app/cuadro-medico/**`, `app/medicos/**`, `app/sobre`, páginas legales, etc. — siguen
  usando `<SearchForm compact />` como hasta ahora.
- `app/api/chat/route.ts`, `lib/chatbot/**` — sin cambios.

## Fuera de alcance
- Variantes de tema / modo oscuro del chat, avatares con imagen real, animaciones
  complejas, streaming token a token, métricas de uso del chat.

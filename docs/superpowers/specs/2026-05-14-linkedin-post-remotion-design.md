# Post de LinkedIn con Remotion — diseño

**Fecha:** 2026-05-14
**Estado:** aprobado, pendiente de implementación
**Objetivo:** generar imágenes cuadradas (1080×1080 PNG) para publicar en LinkedIn anunciando el lanzamiento de buscador-medicos.com, usando Remotion como herramienta de render programático.

## 1. Contexto

`buscador-medicos` es una webapp Next.js 16 que indexa cuadros médicos de 15 mutuas españolas y expone un chat de IA (Claude Haiku 4.5) en la home más un formulario clásico en `/manual`. El producto está listo y se quiere comunicar su lanzamiento en LinkedIn con un post visual.

LinkedIn renderiza las imágenes cuadradas a 1080×1080 sin recortes, por lo que ése es el formato objetivo. El post lo escribirá el usuario; este spec cubre **únicamente el asset visual**.

## 2. Alcance

**En alcance:**
- Subproyecto Remotion aislado del bundle de Next, dentro del mismo repositorio (`/remotion/`).
- Tres composiciones distintas (variantes A/B/C de estética) renderizables como still PNG 1080×1080.
- Scripts npm para previsualizar (`studio`) y renderizar todas las variantes (`render:all`).
- README breve con instrucciones.

**Fuera de alcance:**
- Vídeo (este spec es para stills).
- Otros formatos (vertical 1080×1350, horizontal 1920×1080, etc.).
- Automatización de subida a LinkedIn.
- Selección o redacción del copy del post de texto que acompaña la imagen.

## 3. Arquitectura

### Ubicación

Subproyecto independiente en `/remotion/` con su propio `package.json`. Razón: Remotion arrastra `@remotion/bundler`, `@remotion/renderer` y Chromium headless (~200 MB instalados); meter eso en el `package.json` de la webapp ralentiza el `npm install` de la propia web y no aporta — Remotion es herramienta interna, no runtime del producto.

`/remotion/node_modules/` queda en `.gitignore` (igual que el de la raíz). `/remotion/out/` también gitignored (PNGs renderizados).

### Estructura de archivos

```
remotion/
├── package.json
├── tsconfig.json
├── remotion.config.ts
├── .gitignore                (node_modules, out)
├── README.md
├── src/
│   ├── Root.tsx              (registerRoot + <Composition> por variante)
│   ├── shared/
│   │   ├── theme.ts          (paleta y tipografía como constantes)
│   │   ├── fonts.ts          (carga Inter desde Google Fonts vía @remotion/google-fonts)
│   │   └── Pill.tsx          (componente reutilizado: eyebrow "Nuevo")
│   ├── PostSplit.tsx
│   ├── PostMockup.tsx
│   └── PostTipo.tsx
└── out/                      (PNGs, gitignored)
```

### Stack

- **Remotion 4.x** (`remotion`, `@remotion/cli`, `@remotion/bundler`, `@remotion/renderer`).
- **@remotion/google-fonts** para cargar Inter sin instalar fuente local.
- **React 18** y **TypeScript 5** (consistente con la webapp).

No se usa Tailwind dentro de Remotion — los estilos van en objetos `CSSProperties` inline (patrón estándar de Remotion). La paleta vive en `shared/theme.ts` como constantes para mantener coherencia.

### Tokens de diseño (`shared/theme.ts`)

```ts
export const COLORS = {
  accent: "#2563eb",
  bg: "#ffffff",
  panel: "#f8fafc",      // slate-50
  border: "#e2e8f0",     // slate-200
  textMuted: "#64748b",  // slate-500
  text: "#0f172a",       // slate-900
};
export const FONT = "Inter, sans-serif";
export const WIDTH = 1080;
export const HEIGHT = 1080;
```

## 4. Composiciones

Las tres composiciones son **stills** (un único frame, `durationInFrames={1}`, `fps={30}`). El render produce un PNG por composición.

### A) `PostSplit` — split 52/48

Layout flex horizontal. Lado izquierdo 52% (562 px), lado derecho 48% (518 px).

**Izquierda** (fondo `COLORS.bg`, padding 80 px):
- Pill "🩺 Nuevo" — borde 1px accent, padding 6×14, radius 999, texto accent 14px / 600.
- Titular `buscador-medicos.com` — Inter 72 px / 700, color `COLORS.text`, line-height 1.05. El "." y el dominio en el mismo color (no se decora el TLD).
- Línea decorativa: rectángulo 80×4 px, fondo accent, radius 2.
- Subhead `Pregunta a la IA qué médico de tu mutua va contigo` — 28 px / 500, color `COLORS.text`, max-width 420 px.
- Pie (en la parte inferior, no flotante): `Gratis · 15 mutuas · IA conversacional` — 18 px / 400, color `COLORS.textMuted`.

**Derecha** (fondo `COLORS.panel`, padding 60 px):
- Cabecera del chat (arriba): avatar circular 36 px con emoji 🩺 sobre fondo `COLORS.border`, junto al texto "Asistente" 16 px / 600.
- Burbuja usuario (alineada a la derecha): fondo accent, texto blanco, padding 14×18, radius 18 (esquina inferior-derecha 4), shadow muy sutil. Texto: `Cardiólogo cerca del 28013`, 18 px / 500.
- Burbuja bot (alineada a la izquierda): fondo blanco, borde 1px `COLORS.border`, texto `COLORS.text`, mismo padding y radius (esquina inferior-izquierda 4). Texto en dos líneas: línea 1 `Encontré 12 cardiólogos cerca de ti.` (color `COLORS.text`, 17 px / 500); línea 2 `Mejor valorado: Dr. M. García · ⭐ 4,9 (820 reseñas)` (color `COLORS.textMuted`, 16 px / 400). El nombre es ficticio y a modo de ejemplo, no se pretende que sea un médico real del dataset.

### B) `PostMockup` — mockup centrado

Fondo `COLORS.panel`. Layout vertical centrado (flex column, justify-between).

**Header del lienzo** (40 px desde el top, centrado horizontalmente): pill "🩺 buscador-medicos.com" — fondo blanco, borde 1px `COLORS.border`, padding 8×16, radius 999, texto 16 px / 600 color `COLORS.text`.

**Tarjeta de navegador** centrada, 880×720 px, radius 14, fondo blanco, sombra `0 24px 60px rgba(15,23,42,0.12)`:
- Barra superior 44 px de alto, fondo `COLORS.panel`, borde inferior 1px `COLORS.border`, layout horizontal con padding 14×16:
  - Izquierda: 3 círculos de 12 px (rojo `#ff5f57`, ámbar `#febc2e`, verde `#28c840`), gap 8 px.
  - Centro (flex 1): pseudo-barra de URL — fondo blanco, borde 1px `COLORS.border`, radius 6, padding 4×12, texto `buscador-medicos.com` 13 px / 500 color `COLORS.textMuted`, centrado.
- Cuerpo (resto de los 720 px), padding 48 px: simula el primer fold de la home — eyebrow "🩺 Asistente · Buscador de Médicos" pequeño, titular "Pregunta lo que necesites" 36 px / 700, debajo una caja-input simulada con placeholder `Cardiólogo de Adeslas en el 28013…` 18 px / 400 muted, y debajo las 4 sugerencias del `ChatWidget` (`SUGGESTIONS`) renderizadas como chips horizontales (flex-wrap, gap 8 px, cada chip con borde, radius 999, padding 6×12, 14 px / 500).

**Pie del lienzo** (40 px desde el bottom, centrado): `Encuentra médico de tu mutua en segundos. 15 mutuas. Gratis.` — 22 px / 500, color `COLORS.text`, centrado.

### C) `PostTipo` — tipográfico bold

Fondo `COLORS.bg`. Banda lateral izquierda de 16 px en accent, de top a bottom.

Contenido alineado a la izquierda, padding 100 px:
- Pill `🩺 Nuevo`.
- Bloque grande:
  ```
  Acabo de
  lanzar
  ```
  Inter 96 px / 700, line-height 1.0, color `COLORS.text`.
- Hueco de 32 px.
- `buscador-medicos.com` — Inter 64 px / 700, color accent.
- Separador 80×4 px accent, radius 2.
- `15 mutuas · IA conversacional · Búsqueda en segundos` — 22 px / 500, color `COLORS.textMuted`.

## 5. Flujo de uso

```bash
cd remotion
npm install                    # instala remotion + deps (primera vez)
npm run studio                 # abre Remotion Studio en localhost:3001, preview las 3
npm run render:all             # genera out/post-split.png, out/post-mockup.png, out/post-tipo.png
```

`npm run studio` usa puerto 3001 (no 3000) para no chocar con `npm run dev` de la webapp.

`npm run render:all` encadena los tres renders. Se implementa como tres scripts npm separados encadenados con `&&`, que funciona tanto en cmd.exe (npm en Windows usa cmd por defecto) como en POSIX:

```json
"render:split":  "remotion still src/Root.tsx PostSplit out/post-split.png",
"render:mockup": "remotion still src/Root.tsx PostMockup out/post-mockup.png",
"render:tipo":   "remotion still src/Root.tsx PostTipo out/post-tipo.png",
"render:all":    "npm run render:split && npm run render:mockup && npm run render:tipo"
```

Si en alguna versión de Windows el chaining diera problemas (raro pero posible si npm está configurado para usar PowerShell como script-shell), se sustituye por un script Node `scripts/render-all.mjs` que llama a los tres en serie con `execSync`.

## 6. Datos / contenido

Todo el copy está hardcoded en cada componente. No hay carga dinámica desde `data/` ni desde la webapp — el post no necesita datos reales, sólo refleja el branding ya establecido.

Los emojis usados (🩺, ⭐) son los mismos que ya usa la webapp (`ChatWidget.tsx`, `DoctorCard.tsx`) por coherencia.

## 7. Errores y casos límite

- **Fuente no carga**: `@remotion/google-fonts/Inter` falla raramente. Si ocurre, Remotion cae al sans-serif del sistema y el render igual produce PNG (degradación aceptable para un asset interno).
- **Conflicto de puerto 3001**: si está ocupado, Remotion Studio elige otro automáticamente y avisa.
- **`render:all` con && en otros shells**: se documenta en el README que el script asume cmd-style chaining (npm en Windows). Si se ejecuta en mac/Linux funciona igual porque `&&` también es POSIX.

No hay manejo de errores en runtime: si el render falla, la CLI de Remotion lo reporta con stack trace y no se sube a producción (no es código que se ejecute en la webapp).

## 8. Testing

No se añade test runner (la webapp tampoco tiene uno). Verificación manual:
1. `npm run studio` debe abrir las 3 composiciones sin errores en consola.
2. `npm run render:all` debe producir 3 PNGs en `out/` de 1080×1080.
3. Inspección visual de los 3 PNGs.

## 9. Integración con la webapp

Ninguna. El subproyecto es independiente: no se importa nada desde `../`, no se exponen rutas, no se modifica el `package.json` raíz. La única huella en el repo es:
- Carpeta `/remotion/`.
- Líneas añadidas a `.gitignore` raíz para excluir `remotion/node_modules/` y `remotion/out/`.

## 10. Decisiones diferidas

- **Carrusel multi-slide**: si tras ver las 3 variantes el usuario quiere convertir alguna en carrusel de 3-5 slides, se trata como un follow-up spec separado.
- **Vídeo animado**: si más adelante se quiere versión con motion (Remotion brilla aquí), se añade una composición nueva con `durationInFrames > 1`.
- **Otros formatos**: si LinkedIn cambia recomendaciones o se quiere usar el mismo asset en Twitter/X (1200×675) o Instagram (1080×1350), se añaden composiciones nuevas reutilizando los mismos componentes con tamaño parametrizado.

# LinkedIn Post with Remotion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated `/remotion/` subproject inside the buscador-medicos repo that renders three 1080×1080 still PNGs (PostSplit, PostMockup, PostTipo) for use as a LinkedIn launch announcement image. The user picks the best of the three to publish.

**Architecture:** Standalone subproject with its own `package.json` and `node_modules` — does not touch the Next.js webapp bundle. Remotion 4.x renders single-frame React compositions to PNG via `npx remotion still`. Shared design tokens (`shared/theme.ts`) and a reusable `Pill` primitive feed the three composition files.

**Tech Stack:** Remotion 4.x (`remotion`, `@remotion/cli`, `@remotion/bundler`, `@remotion/renderer`), `@remotion/google-fonts/Inter` for typography, React 18 + TypeScript 5. No test runner — verification is visual + dimensional check on the generated PNGs.

**Spec:** See `docs/superpowers/specs/2026-05-14-linkedin-post-remotion-design.md` for the complete design (paleta, layout de cada variante, copy literal).

---

## File Structure

| File | Responsibility |
|---|---|
| `remotion/package.json` | Subproject manifest, npm scripts (`studio`, `render:*`) |
| `remotion/tsconfig.json` | TypeScript config (extends Remotion's defaults) |
| `remotion/remotion.config.ts` | Remotion config: output dir, image format |
| `remotion/.gitignore` | Ignores local `node_modules/` and `out/` inside subproject |
| `remotion/README.md` | Quick-start docs for the subproject |
| `remotion/src/Root.tsx` | Entry point: `registerRoot` + `<Composition>` per variant |
| `remotion/src/shared/theme.ts` | Color palette and font constants (single source of truth) |
| `remotion/src/shared/fonts.ts` | Loads Inter from Google Fonts via Remotion helper |
| `remotion/src/shared/Pill.tsx` | Reusable "🩺 Nuevo" / "🩺 buscador-medicos.com" pill component |
| `remotion/src/PostSplit.tsx` | Composition A: split 52/48 copy + chat mockup |
| `remotion/src/PostMockup.tsx` | Composition B: browser window mockup centered |
| `remotion/src/PostTipo.tsx` | Composition C: typographic bold "Acabo de lanzar" |
| `.gitignore` (root, modified) | Adds `remotion/node_modules/` and `remotion/out/` |

---

## Task 1: Scaffold the subproject (no Remotion code yet)

**Files:**
- Create: `remotion/package.json`
- Create: `remotion/tsconfig.json`
- Create: `remotion/remotion.config.ts`
- Create: `remotion/.gitignore`
- Create: `remotion/README.md` (minimal — will expand in final task)
- Modify: `.gitignore` (root)

- [ ] **Step 1: Create `remotion/package.json`**

```json
{
  "name": "buscador-medicos-remotion",
  "version": "0.1.0",
  "private": true,
  "description": "Remotion subproject — renders LinkedIn launch stills for buscador-medicos.",
  "scripts": {
    "studio": "remotion studio --port 3001",
    "render:split": "remotion still src/Root.tsx PostSplit out/post-split.png",
    "render:mockup": "remotion still src/Root.tsx PostMockup out/post-mockup.png",
    "render:tipo": "remotion still src/Root.tsx PostTipo out/post-tipo.png",
    "render:all": "npm run render:split && npm run render:mockup && npm run render:tipo"
  },
  "dependencies": {
    "@remotion/bundler": "^4.0.0",
    "@remotion/cli": "^4.0.0",
    "@remotion/google-fonts": "^4.0.0",
    "@remotion/renderer": "^4.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `remotion/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `remotion/remotion.config.ts`**

```ts
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
```

- [ ] **Step 4: Create `remotion/.gitignore`**

```
node_modules/
out/
.remotion/
```

- [ ] **Step 5: Create minimal `remotion/README.md`**

```markdown
# Remotion — buscador-medicos

Stills for LinkedIn launch announcement. See `docs/superpowers/specs/2026-05-14-linkedin-post-remotion-design.md` for the design spec.

Quick start documented at end of implementation (Task 11).
```

- [ ] **Step 6: Add subproject paths to root `.gitignore`**

Append these lines to the existing root `.gitignore` (after the `/out/` line, so the Next.js `/out/` rule keeps working):

```
# remotion subproject
/remotion/node_modules/
/remotion/out/
/remotion/.remotion/
```

- [ ] **Step 7: Verify the structure is in place**

Run from repo root:

```bash
ls remotion/
```

Expected output (order may vary):

```
README.md  remotion.config.ts  tsconfig.json  package.json  .gitignore
```

- [ ] **Step 8: Commit**

```bash
git add remotion/package.json remotion/tsconfig.json remotion/remotion.config.ts remotion/.gitignore remotion/README.md .gitignore
git commit -m "chore(remotion): scaffold subproject skeleton"
```

---

## Task 2: Install dependencies and verify Remotion Studio boots

**Files:**
- Create: `remotion/src/Root.tsx` (minimal placeholder so the studio has something to render)

Installing first because nothing in Task 3+ works without `node_modules`.

- [ ] **Step 1: Install dependencies**

Run from repo root:

```bash
cd remotion && npm install
```

Expected: install completes, creates `remotion/node_modules/` and `remotion/package-lock.json`. This may take 1–3 minutes (Remotion downloads Chromium headless on first install).

- [ ] **Step 2: Create minimal `remotion/src/Root.tsx`**

This is a temporary placeholder so we can boot the studio and confirm the toolchain works. We'll replace its body in later tasks.

```tsx
import { Composition, registerRoot } from "remotion";

const Placeholder: React.FC = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      background: "#f8fafc",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "sans-serif",
      fontSize: 48,
      color: "#0f172a",
    }}
  >
    Placeholder OK
  </div>
);

const RemotionRoot: React.FC = () => (
  <Composition
    id="Placeholder"
    component={Placeholder}
    durationInFrames={1}
    fps={30}
    width={1080}
    height={1080}
  />
);

registerRoot(RemotionRoot);
```

- [ ] **Step 3: Boot the studio**

From `remotion/` directory:

```bash
npm run studio
```

Expected: the CLI prints a `http://localhost:3001` URL and opens it in the default browser. The Studio sidebar lists `Placeholder` as a composition; selecting it shows a 1080×1080 light-grey square with "Placeholder OK" centered.

Stop the studio with Ctrl+C.

- [ ] **Step 4: Render the placeholder as a still (toolchain smoke test)**

From `remotion/` directory:

```bash
npx remotion still src/Root.tsx Placeholder out/placeholder.png
```

Expected: prints "Rendered still to out/placeholder.png" and creates `remotion/out/placeholder.png`. Open the file — it should be a 1080×1080 PNG matching what Studio showed.

- [ ] **Step 5: Commit**

From repo root:

```bash
git add remotion/package.json remotion/package-lock.json remotion/src/Root.tsx
git commit -m "chore(remotion): install deps and verify studio boots"
```

(Note: `remotion/node_modules/` and `remotion/out/` are gitignored, so `package-lock.json` is the only install artifact we commit.)

---

## Task 3: Theme tokens and font loader

**Files:**
- Create: `remotion/src/shared/theme.ts`
- Create: `remotion/src/shared/fonts.ts`

- [ ] **Step 1: Create `remotion/src/shared/theme.ts`**

```ts
export const COLORS = {
  accent: "#2563eb",
  bg: "#ffffff",
  panel: "#f8fafc",      // slate-50
  border: "#e2e8f0",     // slate-200
  textMuted: "#64748b",  // slate-500
  text: "#0f172a",       // slate-900
  windowChromeRed: "#ff5f57",
  windowChromeAmber: "#febc2e",
  windowChromeGreen: "#28c840",
} as const;

export const WIDTH = 1080;
export const HEIGHT = 1080;

export const RADIUS = {
  sm: 6,
  md: 14,
  bubble: 18,
  pill: 999,
} as const;

export const SHADOW_CARD = "0 24px 60px rgba(15, 23, 42, 0.12)";
export const SHADOW_BUBBLE = "0 2px 8px rgba(15, 23, 42, 0.06)";
```

- [ ] **Step 2: Create `remotion/src/shared/fonts.ts`**

```ts
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily, waitUntilDone } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
});

export const INTER_FAMILY = fontFamily;
export const interFontPromise = waitUntilDone();
```

- [ ] **Step 3: Wire the font into `Root.tsx`**

Replace `remotion/src/Root.tsx` contents with:

```tsx
import { Composition, registerRoot } from "remotion";
import "./shared/fonts";
import { INTER_FAMILY } from "./shared/fonts";
import { COLORS, HEIGHT, WIDTH } from "./shared/theme";

const Placeholder: React.FC = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      background: COLORS.panel,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: INTER_FAMILY,
      fontSize: 48,
      fontWeight: 600,
      color: COLORS.text,
    }}
  >
    Inter font loaded
  </div>
);

const RemotionRoot: React.FC = () => (
  <Composition
    id="Placeholder"
    component={Placeholder}
    durationInFrames={1}
    fps={30}
    width={WIDTH}
    height={HEIGHT}
  />
);

registerRoot(RemotionRoot);
```

- [ ] **Step 4: Verify the font loads in a render**

From `remotion/` directory:

```bash
npx remotion still src/Root.tsx Placeholder out/placeholder.png
```

Open the file. The text "Inter font loaded" should render in Inter (not the browser default sans-serif). If it falls back to system sans, check the console for errors from `@remotion/google-fonts`.

- [ ] **Step 5: Commit**

From repo root:

```bash
git add remotion/src/shared/theme.ts remotion/src/shared/fonts.ts remotion/src/Root.tsx
git commit -m "feat(remotion): add theme tokens and Inter font loader"
```

---

## Task 4: Reusable Pill primitive

**Files:**
- Create: `remotion/src/shared/Pill.tsx`

- [ ] **Step 1: Create `remotion/src/shared/Pill.tsx`**

```tsx
import { CSSProperties } from "react";
import { COLORS, RADIUS } from "./theme";
import { INTER_FAMILY } from "./fonts";

type Variant = "outline" | "solid";

type Props = {
  children: React.ReactNode;
  variant?: Variant;
  fontSize?: number;
  style?: CSSProperties;
};

export const Pill: React.FC<Props> = ({
  children,
  variant = "outline",
  fontSize = 14,
  style,
}) => {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontFamily: INTER_FAMILY,
    fontSize,
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: RADIUS.pill,
    lineHeight: 1,
  };

  if (variant === "outline") {
    return (
      <span
        style={{
          ...base,
          border: `1px solid ${COLORS.accent}`,
          color: COLORS.accent,
          background: "transparent",
          ...style,
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      style={{
        ...base,
        border: `1px solid ${COLORS.border}`,
        color: COLORS.text,
        background: COLORS.bg,
        ...style,
      }}
    >
      {children}
    </span>
  );
};
```

- [ ] **Step 2: Temporarily preview the Pill in `Root.tsx`**

Replace the `Placeholder` component body in `remotion/src/Root.tsx`:

```tsx
import { Composition, registerRoot } from "remotion";
import "./shared/fonts";
import { INTER_FAMILY } from "./shared/fonts";
import { COLORS, HEIGHT, WIDTH } from "./shared/theme";
import { Pill } from "./shared/Pill";

const Placeholder: React.FC = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      background: COLORS.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 24,
      fontFamily: INTER_FAMILY,
    }}
  >
    <Pill variant="outline">🩺 Nuevo</Pill>
    <Pill variant="solid" fontSize={16}>🩺 buscador-medicos.com</Pill>
  </div>
);

const RemotionRoot: React.FC = () => (
  <Composition
    id="Placeholder"
    component={Placeholder}
    durationInFrames={1}
    fps={30}
    width={WIDTH}
    height={HEIGHT}
  />
);

registerRoot(RemotionRoot);
```

- [ ] **Step 3: Verify both pill variants render**

From `remotion/`:

```bash
npx remotion still src/Root.tsx Placeholder out/placeholder.png
```

Open the PNG. You should see two pills stacked vertically in the center:
- Top: blue outlined "🩺 Nuevo".
- Bottom: white pill with thin grey border, dark text, "🩺 buscador-medicos.com".

- [ ] **Step 4: Commit**

```bash
git add remotion/src/shared/Pill.tsx remotion/src/Root.tsx
git commit -m "feat(remotion): add reusable Pill primitive"
```

---

## Task 5: PostSplit composition (variant A)

**Files:**
- Create: `remotion/src/PostSplit.tsx`
- Modify: `remotion/src/Root.tsx` (register `PostSplit` composition)

- [ ] **Step 1: Create `remotion/src/PostSplit.tsx`**

```tsx
import { CSSProperties } from "react";
import { COLORS, RADIUS, SHADOW_BUBBLE } from "./shared/theme";
import { INTER_FAMILY } from "./shared/fonts";
import { Pill } from "./shared/Pill";

const bubbleBase: CSSProperties = {
  fontFamily: INTER_FAMILY,
  padding: "14px 18px",
  borderRadius: RADIUS.bubble,
  maxWidth: 360,
  boxShadow: SHADOW_BUBBLE,
  lineHeight: 1.35,
};

export const PostSplit: React.FC = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      fontFamily: INTER_FAMILY,
      background: COLORS.bg,
    }}
  >
    {/* LEFT 52% */}
    <div
      style={{
        flex: "0 0 52%",
        padding: 80,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <Pill variant="outline">🩺 Nuevo</Pill>
        <h1
          style={{
            margin: 0,
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.05,
            color: COLORS.text,
            letterSpacing: -1.5,
          }}
        >
          buscador-<br />medicos.com
        </h1>
        <div
          style={{
            width: 80,
            height: 4,
            background: COLORS.accent,
            borderRadius: 2,
          }}
        />
        <p
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 500,
            color: COLORS.text,
            maxWidth: 420,
            lineHeight: 1.3,
          }}
        >
          Pregunta a la IA qué médico de tu mutua va contigo
        </p>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 400,
          color: COLORS.textMuted,
        }}
      >
        Gratis · 15 mutuas · IA conversacional
      </p>
    </div>

    {/* RIGHT 48% */}
    <div
      style={{
        flex: "1 1 48%",
        background: COLORS.panel,
        padding: 60,
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* chat header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: COLORS.border,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
          }}
        >
          🩺
        </div>
        <span style={{ fontSize: 16, fontWeight: 600, color: COLORS.text }}>
          Asistente
        </span>
      </div>

      {/* user bubble */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            ...bubbleBase,
            background: COLORS.accent,
            color: "#ffffff",
            borderBottomRightRadius: 4,
            fontSize: 18,
            fontWeight: 500,
          }}
        >
          Cardiólogo cerca del 28013
        </div>
      </div>

      {/* bot bubble */}
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <div
          style={{
            ...bubbleBase,
            background: COLORS.bg,
            border: `1px solid ${COLORS.border}`,
            color: COLORS.text,
            borderBottomLeftRadius: 4,
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 500 }}>
            Encontré 12 cardiólogos cerca de ti.
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 400,
              color: COLORS.textMuted,
              marginTop: 4,
            }}
          >
            Mejor valorado: Dr. M. García · ⭐ 4,9 (820 reseñas)
          </div>
        </div>
      </div>
    </div>
  </div>
);
```

- [ ] **Step 2: Register `PostSplit` in `Root.tsx`**

Replace `remotion/src/Root.tsx` contents with:

```tsx
import { Composition, registerRoot } from "remotion";
import "./shared/fonts";
import { HEIGHT, WIDTH } from "./shared/theme";
import { PostSplit } from "./PostSplit";

const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="PostSplit"
      component={PostSplit}
      durationInFrames={1}
      fps={30}
      width={WIDTH}
      height={HEIGHT}
    />
  </>
);

registerRoot(RemotionRoot);
```

- [ ] **Step 3: Render PostSplit**

From `remotion/`:

```bash
npm run render:split
```

Expected: writes `remotion/out/post-split.png`.

- [ ] **Step 4: Verify PostSplit visually + dimensionally**

Open `remotion/out/post-split.png`. Check:
- File dimensions are 1080×1080 (right-click → properties on Windows, or `file` on Unix).
- Left half: blue "🩺 Nuevo" pill at top, large "buscador-medicos.com" title below, accent line, subhead, muted footer line.
- Right half: light grey panel with chat header, blue user bubble on the right, white bot bubble on the left with two lines (the second tenuer).
- No clipped text, no overlapping elements.

If anything looks off, boot the studio (`npm run studio`) and iterate on `PostSplit.tsx` until it matches.

- [ ] **Step 5: Commit**

```bash
git add remotion/src/PostSplit.tsx remotion/src/Root.tsx
git commit -m "feat(remotion): add PostSplit composition"
```

---

## Task 6: PostMockup composition (variant B)

**Files:**
- Create: `remotion/src/PostMockup.tsx`
- Modify: `remotion/src/Root.tsx` (register `PostMockup`)

- [ ] **Step 1: Create `remotion/src/PostMockup.tsx`**

```tsx
import { CSSProperties } from "react";
import { COLORS, RADIUS, SHADOW_CARD } from "./shared/theme";
import { INTER_FAMILY } from "./shared/fonts";
import { Pill } from "./shared/Pill";

const SUGGESTIONS = [
  "El mejor cardiólogo de Adeslas en el 28001",
  "Dermatólogo de Sanitas en Valencia",
  "Pediatra de DKV cerca de Sevilla",
  "Traumatólogo de Adeslas en Barcelona",
];

const chip: CSSProperties = {
  fontFamily: INTER_FAMILY,
  fontSize: 14,
  fontWeight: 500,
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.bg,
  borderRadius: RADIUS.pill,
  padding: "6px 12px",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
};

const windowDot = (color: string): CSSProperties => ({
  width: 12,
  height: 12,
  borderRadius: "50%",
  background: color,
});

export const PostMockup: React.FC = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      background: COLORS.panel,
      fontFamily: INTER_FAMILY,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "40px 0",
    }}
  >
    {/* TOP pill */}
    <Pill variant="solid" fontSize={16}>
      🩺 buscador-medicos.com
    </Pill>

    {/* CENTER browser-window card */}
    <div
      style={{
        width: 880,
        height: 720,
        borderRadius: RADIUS.md,
        background: COLORS.bg,
        boxShadow: SHADOW_CARD,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* chrome bar */}
      <div
        style={{
          height: 44,
          background: COLORS.panel,
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <div style={windowDot(COLORS.windowChromeRed)} />
          <div style={windowDot(COLORS.windowChromeAmber)} />
          <div style={windowDot(COLORS.windowChromeGreen)} />
        </div>
        <div
          style={{
            flex: 1,
            background: COLORS.bg,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm,
            padding: "4px 12px",
            fontSize: 13,
            fontWeight: 500,
            color: COLORS.textMuted,
            textAlign: "center",
          }}
        >
          buscador-medicos.com
        </div>
      </div>

      {/* body */}
      <div
        style={{
          flex: 1,
          padding: 48,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textMuted }}>
          🩺 Asistente · Buscador de Médicos
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 36,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: -0.5,
          }}
        >
          Pregunta lo que necesites
        </h2>
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            background: COLORS.bg,
            borderRadius: RADIUS.sm,
            padding: "16px 18px",
            fontSize: 18,
            fontWeight: 400,
            color: COLORS.textMuted,
          }}
        >
          Cardiólogo de Adeslas en el 28013…
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SUGGESTIONS.map((text) => (
            <span key={text} style={chip}>
              {text}
            </span>
          ))}
        </div>
      </div>
    </div>

    {/* BOTTOM tagline */}
    <p
      style={{
        margin: 0,
        fontSize: 22,
        fontWeight: 500,
        color: COLORS.text,
        textAlign: "center",
      }}
    >
      Encuentra médico de tu mutua en segundos. 15 mutuas. Gratis.
    </p>
  </div>
);
```

- [ ] **Step 2: Register `PostMockup` in `Root.tsx`**

Replace `remotion/src/Root.tsx` contents with:

```tsx
import { Composition, registerRoot } from "remotion";
import "./shared/fonts";
import { HEIGHT, WIDTH } from "./shared/theme";
import { PostSplit } from "./PostSplit";
import { PostMockup } from "./PostMockup";

const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="PostSplit"
      component={PostSplit}
      durationInFrames={1}
      fps={30}
      width={WIDTH}
      height={HEIGHT}
    />
    <Composition
      id="PostMockup"
      component={PostMockup}
      durationInFrames={1}
      fps={30}
      width={WIDTH}
      height={HEIGHT}
    />
  </>
);

registerRoot(RemotionRoot);
```

- [ ] **Step 3: Render PostMockup**

From `remotion/`:

```bash
npm run render:mockup
```

Expected: writes `remotion/out/post-mockup.png`.

- [ ] **Step 4: Verify PostMockup visually + dimensionally**

Open `remotion/out/post-mockup.png`. Check:
- 1080×1080 dimensions.
- Light grey background.
- White pill at top with "🩺 buscador-medicos.com".
- Centered browser window card with traffic-light dots on the left of the chrome bar and the URL pill centered.
- Card body shows "Asistente · Buscador de Médicos" eyebrow, "Pregunta lo que necesites" title, an input-looking row with placeholder text, and 4 suggestion chips wrapped on one or two lines.
- Tagline at bottom centered: "Encuentra médico de tu mutua en segundos. 15 mutuas. Gratis."
- The card has a soft shadow beneath.

If suggestions overflow horizontally, that's expected (they wrap because of `flex-wrap: wrap`). No clipping should occur.

- [ ] **Step 5: Commit**

```bash
git add remotion/src/PostMockup.tsx remotion/src/Root.tsx
git commit -m "feat(remotion): add PostMockup composition"
```

---

## Task 7: PostTipo composition (variant C)

**Files:**
- Create: `remotion/src/PostTipo.tsx`
- Modify: `remotion/src/Root.tsx` (register `PostTipo`)

- [ ] **Step 1: Create `remotion/src/PostTipo.tsx`**

```tsx
import { COLORS } from "./shared/theme";
import { INTER_FAMILY } from "./shared/fonts";
import { Pill } from "./shared/Pill";

export const PostTipo: React.FC = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      background: COLORS.bg,
      fontFamily: INTER_FAMILY,
      display: "flex",
      position: "relative",
    }}
  >
    {/* left accent band */}
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        bottom: 0,
        width: 16,
        background: COLORS.accent,
      }}
    />

    {/* content */}
    <div
      style={{
        flex: 1,
        padding: 100,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 32,
      }}
    >
      <Pill variant="outline">🩺 Nuevo</Pill>

      <h1
        style={{
          margin: 0,
          fontSize: 96,
          fontWeight: 700,
          lineHeight: 1,
          color: COLORS.text,
          letterSpacing: -2.5,
        }}
      >
        Acabo de
        <br />
        lanzar
      </h1>

      <div
        style={{
          fontSize: 64,
          fontWeight: 700,
          color: COLORS.accent,
          letterSpacing: -1.5,
          lineHeight: 1.05,
        }}
      >
        buscador-medicos.com
      </div>

      <div
        style={{
          width: 80,
          height: 4,
          background: COLORS.accent,
          borderRadius: 2,
        }}
      />

      <p
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 500,
          color: COLORS.textMuted,
          maxWidth: 720,
          lineHeight: 1.4,
        }}
      >
        15 mutuas · IA conversacional · Búsqueda en segundos
      </p>
    </div>
  </div>
);
```

- [ ] **Step 2: Register `PostTipo` in `Root.tsx`**

Replace `remotion/src/Root.tsx` contents with the final version (all three compositions registered):

```tsx
import { Composition, registerRoot } from "remotion";
import "./shared/fonts";
import { HEIGHT, WIDTH } from "./shared/theme";
import { PostSplit } from "./PostSplit";
import { PostMockup } from "./PostMockup";
import { PostTipo } from "./PostTipo";

const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="PostSplit"
      component={PostSplit}
      durationInFrames={1}
      fps={30}
      width={WIDTH}
      height={HEIGHT}
    />
    <Composition
      id="PostMockup"
      component={PostMockup}
      durationInFrames={1}
      fps={30}
      width={WIDTH}
      height={HEIGHT}
    />
    <Composition
      id="PostTipo"
      component={PostTipo}
      durationInFrames={1}
      fps={30}
      width={WIDTH}
      height={HEIGHT}
    />
  </>
);

registerRoot(RemotionRoot);
```

- [ ] **Step 3: Render PostTipo**

From `remotion/`:

```bash
npm run render:tipo
```

Expected: writes `remotion/out/post-tipo.png`.

- [ ] **Step 4: Verify PostTipo visually + dimensionally**

Open `remotion/out/post-tipo.png`. Check:
- 1080×1080 dimensions.
- White background with a thin vertical blue band along the left edge.
- Pill "🩺 Nuevo" near the top.
- Huge "Acabo de / lanzar" stacked title.
- Blue "buscador-medicos.com" below the title.
- Short accent line separator.
- Muted tagline at the bottom: "15 mutuas · IA conversacional · Búsqueda en segundos".
- All vertically centered (the content block is vertically centered within the right area).

- [ ] **Step 5: Commit**

```bash
git add remotion/src/PostTipo.tsx remotion/src/Root.tsx
git commit -m "feat(remotion): add PostTipo composition"
```

---

## Task 8: Render all three at once + final verification

**Files:** none (uses scripts already defined in Task 1).

- [ ] **Step 1: Clean the `out/` directory**

From `remotion/`:

```bash
rm -rf out
```

(On PowerShell: `Remove-Item -Recurse -Force out`. Or just delete the folder manually.)

- [ ] **Step 2: Render all three via the combined script**

From `remotion/`:

```bash
npm run render:all
```

Expected output (abridged):

```
> npm run render:split
Rendered still to out/post-split.png
> npm run render:mockup
Rendered still to out/post-mockup.png
> npm run render:tipo
Rendered still to out/post-tipo.png
```

If chaining fails on your shell (rare; only seen when npm is configured to use PowerShell as script-shell on Windows), fall back to running the three scripts individually.

- [ ] **Step 3: Verify all three PNGs exist with correct dimensions**

From repo root:

```bash
ls -la remotion/out/
```

Expected: three files, each 1080×1080 PNG: `post-split.png`, `post-mockup.png`, `post-tipo.png`.

Open all three and confirm they match the visual checks from Tasks 5, 6, and 7. None of them are committed (the `out/` directory is gitignored).

- [ ] **Step 4: No commit needed for this task**

This task only verifies. The `out/` directory is gitignored intentionally — the user picks one of the three to upload manually to LinkedIn.

---

## Task 9: Final README

**Files:**
- Modify: `remotion/README.md`

- [ ] **Step 1: Replace `remotion/README.md` with the full version**

```markdown
# Remotion — buscador-medicos

Renders LinkedIn launch announcement stills (1080×1080 PNG) for buscador-medicos.com. Independent subproject — does NOT share `package.json` or `node_modules` with the Next.js webapp in the repo root.

See `../docs/superpowers/specs/2026-05-14-linkedin-post-remotion-design.md` for the full design spec.

## Install

```bash
cd remotion
npm install
```

First install downloads Chromium headless via `@remotion/renderer` — expect 1–3 minutes and ~200 MB on disk.

## Preview in the browser

```bash
npm run studio
```

Opens Remotion Studio at `http://localhost:3001` (port 3001 to avoid colliding with `npm run dev` of the webapp on :3000). The sidebar lists three compositions:

- **PostSplit** — split 52/48 copy + chat mockup.
- **PostMockup** — centered browser-window mockup of the home.
- **PostTipo** — typographic "Acabo de lanzar" bold style.

Iterate by editing the corresponding `src/Post*.tsx` file; the Studio hot-reloads.

## Render to PNG

Render one composition:

```bash
npm run render:split
npm run render:mockup
npm run render:tipo
```

Or all three at once:

```bash
npm run render:all
```

Outputs land in `remotion/out/` (gitignored). Pick the one you like best and upload to LinkedIn manually.

## File layout

- `src/Root.tsx` — registers the three compositions.
- `src/shared/theme.ts` — colors, dimensions, radii. Edit here to retheme all three at once.
- `src/shared/fonts.ts` — loads Inter via `@remotion/google-fonts`.
- `src/shared/Pill.tsx` — reusable pill component.
- `src/PostSplit.tsx`, `src/PostMockup.tsx`, `src/PostTipo.tsx` — one per variant.

## Notes

- No test runner. Verification is visual + dimensional check on the generated PNGs.
- Each composition is `durationInFrames={1}` because we render stills, not video.
- The webapp's `package.json` is untouched by this subproject.
```

- [ ] **Step 2: Commit**

```bash
git add remotion/README.md
git commit -m "docs(remotion): expand README with usage instructions"
```

---

## Task 10: Push and present the result

**Files:** none.

- [ ] **Step 1: Push to remote**

```bash
git push
```

- [ ] **Step 2: Tell the user the three PNGs are ready**

Show the three file paths:

- `remotion/out/post-split.png`
- `remotion/out/post-mockup.png`
- `remotion/out/post-tipo.png`

Remind them these are gitignored (intentional — they pick one to upload manually). If they want to regenerate after editing copy/colors, `cd remotion && npm run render:all`.

---

## Final notes

- **No automated tests** by design (per spec section 8). The verification gate is opening each PNG and confirming the layout.
- **Total expected commits:** 9 (one per substantive task, excluding Task 8 which is verification-only and Task 10 which is push-only).
- **Reverting:** every commit is self-contained; if a composition turns out badly you can `git revert` just that one.

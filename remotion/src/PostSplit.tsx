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

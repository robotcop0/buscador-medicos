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
    <Pill variant="solid" fontSize={16} style={{ alignSelf: "center" }}>
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

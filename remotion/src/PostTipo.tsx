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

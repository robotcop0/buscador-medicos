import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Buscador de Médicos — Encuentra tu especialista por mutua y zona";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "#f7f6f3",
          color: "#111827",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 24,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#9ca3af",
          }}
        >
          Buscador de Médicos
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 96, lineHeight: 1.05, fontWeight: 300 }}>
            Encuentra <span style={{ fontWeight: 700 }}>tu mejor médico.</span>
          </div>
          <div style={{ fontSize: 32, color: "#6b7280", fontWeight: 300 }}>
            15 mutuas · ratings reales · búsqueda por código postal
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 18,
            color: "#9ca3af",
          }}
        >
          {[
            "Adeslas",
            "Sanitas",
            "DKV",
            "Asisa",
            "Mapfre",
            "Cigna",
            "Allianz",
            "AXA",
            "Caser",
            "Divina Pastora",
            "Fiatc",
            "Generali",
            "IMQ",
            "MUFACE",
            "Occidente",
          ].map((m) => (
            <span
              key={m}
              style={{
                padding: "6px 14px",
                border: "1px solid #e5e7eb",
                borderRadius: 999,
                background: "#fff",
              }}
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}

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

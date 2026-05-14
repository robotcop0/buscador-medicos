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

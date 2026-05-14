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

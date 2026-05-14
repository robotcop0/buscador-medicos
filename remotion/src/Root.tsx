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

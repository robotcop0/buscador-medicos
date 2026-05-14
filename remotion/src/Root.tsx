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

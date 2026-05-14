import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily, waitUntilDone } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
});

export const INTER_FAMILY = fontFamily;
export const interFontPromise = waitUntilDone();

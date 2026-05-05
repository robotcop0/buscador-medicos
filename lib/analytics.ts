type EventProps = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: EventProps }) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, props?: EventProps): void {
  if (typeof window === "undefined") return;

  const cleanProps = props
    ? Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined))
    : undefined;

  window.plausible?.(event, cleanProps ? { props: cleanProps } : undefined);
  window.gtag?.("event", event, cleanProps);

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("[track]", event, cleanProps);
  }
}

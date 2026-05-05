"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { track } from "@/lib/analytics";

type EventProps = Record<string, string | number | boolean | undefined>;

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  event: string;
  eventProps?: EventProps;
};

export default function TrackedAnchor({
  event,
  eventProps,
  onClick,
  children,
  ...rest
}: Props) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    track(event, eventProps);
    onClick?.(e);
  }
  return (
    <a {...rest} onClick={handleClick}>
      {children}
    </a>
  );
}

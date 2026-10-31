import type { ReactNode } from "react";

export type IconName =
  | "send"
  | "shield"
  | "spark"
  | "split"
  | "step"
  | "users"
  | "map"
  | "bridge"
  | "home"
  | "truck"
  | "play"
  | "pause"
  | "rewind"
  | "arrow"
  | "radio"
  | "check"
  | "clock"
  | "layers"
  | "reset"
  | "close"
  | "info"
  | "download"
  | "rain"
  | "eye"
  | "chevron"
  | "mic"
  | "camera";
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    map: (
      <>
        <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z" />
        <path d="M9 3v16M15 5v16" />
      </>
    ),
    bridge: (
      <>
        <path d="M3 19V5m18 14V5M3 9c6 6 12 6 18 0M1 17h22M8 13v4m8-4v4" />
      </>
    ),
    home: (
      <>
        <path d="m3 10 9-7 9 7v11H3Z" />
        <path d="M9 21v-7h6v7M10 9h4m-2-2v4" />
      </>
    ),
    truck: (
      <>
        <path d="M2 5h12v13H2ZM14 10h4l4 5v3h-8" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),
    play: <path d="m8 4 12 8-12 8Z" />,
    pause: (
      <>
        <path d="M7 4v16M17 4v16" />
      </>
    ),
    rewind: (
      <>
        <path d="m12 7-8 5 8 5Zm9 0-8 5 8 5Z" />
        <path d="M3 5v14" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    camera: (
      <>
        <path d="M4 8h3l2-3h6l2 3h3v11H4Z" />
        <circle cx="12" cy="13" r="3.5" />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </>
    ),
    radio: (
      <>
        <circle cx="12" cy="12" r="2" />
        <path d="M7 7a7 7 0 0 0 0 10m10-10a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    layers: (
      <>
        <path d="m2 8 10-5 10 5-10 5Zm0 5 10 5 10-5M2 18l10 5 10-5" />
      </>
    ),
    reset: (
      <>
        <path d="M3 10a9 9 0 1 1 1 8M3 3v7h7" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7v1" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    rain: (
      <>
        <path d="M6 14a4 4 0 1 1 1-8 5 5 0 0 1 10 1 3.5 3.5 0 0 1 1 7ZM7 18l-1 3m6-3-1 3m6-3-1 3" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
    send: <path d="M4 12 20 4l-5 16-3-7Zm8 1 8-9" />,
    shield: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Zm-3 9 2 2 4-4" />,
    spark: <path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6" />,
    split: <path d="M6 3v6a6 6 0 0 0 6 6h6M6 9v12m12-6-3-3m3 3-3 3" />,
    step: <><path d="m5 5 9 7-9 7Z" /><path d="M18 5v14" /></>,
    users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

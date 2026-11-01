import { useCallback, useRef, useState } from "react";
import type { ApprovedCommand } from "@crisiscraft/contracts";
import type { PhotoEvent, PhotoRead, Segment } from "@crisiscraft/crew";
import { askPhoto } from "../api";
import { Icon } from "../icons";
import { mm } from "../format";
import { Avatar } from "./Radio";

export interface PhotoState {
  minute: number;
  image: string | null;
  scene: string | null;
  segments: {
    width: number;
    height: number;
    list: Segment[];
    waterOnBridge: number | null;
  } | null;
  read: PhotoRead | null;
  timings: { model: string; ms: number }[];
  error: string | null;
  loading: boolean;
}

/** June's field photo for the current minute; reset whenever the run changes underneath it. */
export function usePhoto(minute: number) {
  const [photo, setPhoto] = useState<PhotoState | null>(null);
  const abort = useRef<AbortController | null>(null);
  const take = useCallback(
    async (commands: { tick: number; command: ApprovedCommand }[]) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setPhoto({
        minute,
        image: null,
        scene: null,
        segments: null,
        read: null,
        timings: [],
        error: null,
        loading: true,
      });
      const on = (e: PhotoEvent) =>
        setPhoto((p) => {
          if (!p) return p;
          const timings = [...p.timings, { model: e.model, ms: e.ms }];
          if (e.kind === "image")
            return { ...p, image: e.image, scene: e.scene, timings };
          if (e.kind === "segments")
            return {
              ...p,
              segments: {
                width: e.width,
                height: e.height,
                list: e.segments,
                waterOnBridge: e.waterOnBridge,
              },
              timings,
            };
          return { ...p, read: e.read, timings, loading: false };
        });
      try {
        await askPhoto({ minute, commands }, on, controller.signal);
      } catch (error) {
        if (controller.signal.aborted) return;
        setPhoto(
          (p) =>
            p && {
              ...p,
              loading: false,
              error:
                error instanceof Error
                  ? error.message
                  : "The photo did not come through.",
            },
        );
      }
    },
    [minute],
  );
  const clear = useCallback(() => {
    abort.current?.abort();
    setPhoto(null);
  }, []);
  return { photo, take, clear };
}

const verdict: Record<PhotoRead["passable"], { label: string; tone: string }> =
  {
    yes: { label: "Passable", tone: "good" },
    risky: { label: "Risky", tone: "warn" },
    no: { label: "Not passable", tone: "bad" },
  };

const stage = (p: PhotoState) =>
  !p.image
    ? "Generating June's drill image · Muse Image"
    : !p.segments
      ? "Outlining the bridge and the water · SAM 3.1"
      : "June is reading the photo · Muse Spark";

function Overlay({
  segments,
}: {
  segments: NonNullable<PhotoState["segments"]>;
}) {
  if (!segments.width) return null;
  return (
    <svg
      className="photo-overlay"
      viewBox={`0 0 ${segments.width} ${segments.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {segments.list.map((s) => {
        const sx = (s.box.right - s.box.left) / s.raster.width;
        const sy = (s.box.bottom - s.box.top) / s.raster.height;
        return (
          <g key={s.concept} className={`seg seg-${s.concept}`}>
            <path
              d={s.path}
              transform={`translate(${s.box.left} ${s.box.top}) scale(${sx} ${sy})`}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}

/** One radio turn built from three Meta models: Muse Image renders, SAM 3.1 segments, Muse Spark judges. */
export function PhotoTurn({
  photo,
  currentMinute,
}: {
  photo: PhotoState;
  currentMinute: number;
}) {
  const [outlines, setOutlines] = useState(true);
  const v = photo.read ? verdict[photo.read.passable] : null;
  const share = photo.segments?.waterOnBridge;
  return (
    <li className="turn turn-photo from-field">
      <Avatar from="field" size={26} />
      <div className="turn-body">
        <div className="turn-head">
          <strong>June</strong>
          <span className="kind kind-photo">
            Generated drill image · min {mm(photo.minute)}
          </span>
          {v && <span className={`pill ${v.tone}`}>{v.label}</span>}
          {photo.minute !== currentMinute && (
            <span className="photo-age">
              {currentMinute - photo.minute} min old
            </span>
          )}
        </div>
        <figure className={`photo ${photo.image ? "" : "pending"}`}>
          {photo.image ? (
            <img
              src={photo.image}
              alt={`Generated drill image of the north bridge at minute ${photo.minute}: ${photo.scene ?? ""}`}
            />
          ) : (
            <div className="photo-wait">
              <Icon name="camera" size={22} />
            </div>
          )}
          {photo.segments && outlines && <Overlay segments={photo.segments} />}
          {photo.segments && (
            <figcaption>
              <span className="legend">
                <i className="sw-bridge" /> bridge
              </span>
              <span className="legend">
                <i className="sw-floodwater" /> floodwater
              </span>
              {share != null && (
                <b>
                  Water overlaps {Math.round(share * 100)}% of detected bridge
                  mask
                </b>
              )}
              <button className="link" onClick={() => setOutlines(!outlines)}>
                {outlines ? "hide" : "show"} outlines
              </button>
            </figcaption>
          )}
        </figure>
        {photo.read && <p>{photo.read.message}</p>}
        {photo.loading && (
          <p className="dots">
            {stage(photo)}
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </p>
        )}
        {photo.error && (
          <p className="notice bad" role="alert">
            {photo.error}
          </p>
        )}
        {photo.timings.length > 0 && (
          <div className="turn-meta">
            {photo.timings.map((t) => (
              <span key={t.model} className="cite">
                {t.model} · {(t.ms / 1000).toFixed(1)}s
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

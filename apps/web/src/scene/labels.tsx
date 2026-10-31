import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { Point } from "./layout";

export type Tone = "ok" | "warn" | "alert" | "idle";

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Projects a DOM chip onto a 3D anchor. Chips live outside the Canvas reconciler and are owned
 * synchronously by this effect, so a delayed cleanup can never clear a newer chip's reference.
 */
function useChip(
  root: HTMLDivElement,
  at: Point | (() => Point),
  html: string,
  className: string,
  onClick?: () => void,
  label?: string,
) {
  const ref = useRef<HTMLElement | null>(null);
  const click = useRef(onClick);
  click.current = onClick;
  const clickable = Boolean(onClick);
  const point = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    const el = ref.current;
    if (!el) return;
    const anchor = typeof at === "function" ? at() : at;
    point.set(anchor[0], anchor[1], anchor[2]).project(camera);
    const x = ((point.x + 1) * size.width) / 2;
    const y = ((1 - point.y) * size.height) / 2;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    el.style.visibility = point.z > 1 || x < 8 || x > size.width - 8 || y < 8 || y > size.height + 20 ? "hidden" : "visible";
    el.style.zIndex = String(Math.round((1 - point.z) * 10000));
  });
  useEffect(() => {
    const el = document.createElement(clickable ? "button" : "div");
    el.style.visibility = "hidden";
    if (clickable) {
      el.onclick = () => click.current?.();
      (el as HTMLButtonElement).type = "button";
    }
    root.appendChild(el);
    ref.current = el;
    return () => {
      if (ref.current === el) ref.current = null;
      el.remove();
    };
  }, [root, clickable]);
  // Content updates in place so a changing status never makes the chip blink.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.className = className;
    el.innerHTML = html;
    if (label) el.setAttribute("aria-label", label);
  }, [root, clickable, html, className, label]);
}

export function PlaceChip({
  root,
  at,
  name,
  detail,
  tone,
  selected,
  onSelect,
}: {
  root: HTMLDivElement;
  at: Point | (() => Point);
  name: string;
  detail: string;
  tone: Tone;
  selected: boolean;
  onSelect?: () => void;
}) {
  const html = `<span class="cc-dot cc-${tone}"></span><span class="cc-chip-text"><strong>${escape(name)}</strong><small>${escape(detail)}</small></span>`;
  useChip(root, at, html, `cc-chip cc-place${selected ? " cc-selected" : ""}`, onSelect, `Inspect ${name}`);
  return null;
}

export function CrewChip({
  root,
  at,
  name,
  title,
  status,
  line,
  bubbles,
}: {
  root: HTMLDivElement;
  at: Point;
  name: string;
  title: string;
  status: "idle" | "thinking" | "speaking";
  line?: string;
  bubbles: boolean;
}) {
  const said = line && line.length > 90 ? `${line.slice(0, 88).trimEnd()}…` : line;
  const bubble = bubbles && status === "speaking" && said ? `<span class="cc-bubble">${escape(said)}</span>` : "";
  const thinking = status === "thinking" ? `<span class="cc-thinking" aria-label="thinking"><i></i><i></i><i></i></span>` : "";
  const html = `${bubble}<span class="cc-chip cc-crew cc-${status}"><span class="cc-avatar">${escape(name.charAt(0))}</span><strong>${escape(name)}</strong><em>${escape(title)}</em>${thinking}</span>`;
  useChip(root, at, html, "cc-crew-anchor");
  return null;
}

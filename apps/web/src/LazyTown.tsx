import { lazy, Suspense } from "react";
import type { TownProps } from "./Town";

const Town = lazy(() => import("./Town").then((m) => ({ default: m.Town })));

/** The 3D town is the heaviest module; the interface paints first while it loads. */
export function LazyTown(props: TownProps) {
  return (
    <Suspense fallback={<div className="town-loading"><span>Raising Harbor Point…</span></div>}>
      <Town {...props} />
    </Suspense>
  );
}

"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "@/components/map/LeafletMiniMap";

const LeafletMiniMap = dynamic(() => import("@/components/map/LeafletMiniMap"), {
  ssr: false,
  loading: () => (
    <div className="skeletonMap">
      <div className="skeletonMapOverlay">
        <div className="skeletonMapPin">
          <div className="skeletonMapPinIcon" />
        </div>
        <div className="skeletonMapScale">
          {Array.from({length: 3}).map((_, i) => (
            <div key={i} className="skeletonMapScaleLine" style={{'--i': i} as React.CSSProperties} />
          ))}
        </div>
      </div>
    </div>
  ),
});

export function MiniMap({
  points,
  activeId,
  className,
}: {
  points: MapPoint[];
  activeId?: string;
  className?: string;
}) {
  return (
    <div className={`miniMap ${className ?? ""}`}>
      <LeafletMiniMap points={points} activeId={activeId} />
      <span className="mapAttributionNote">OpenStreetMap</span>
    </div>
  );
}

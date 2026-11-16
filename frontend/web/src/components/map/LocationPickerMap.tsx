"use client";

import dynamic from "next/dynamic";
import type { LocationPickerProps } from "./LeafletLocationPickerMap";

const LeafletPicker = dynamic(
  () => import("./LeafletLocationPickerMap"),
  {
    ssr: false,
    loading: () => (
      <div
        className="skeletonMap"
        style={{
          height: "240px",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface-muted, #f1f5f9)",
          color: "var(--muted, #64748b)",
          fontSize: "13px",
          marginTop: "6px",
        }}
      >
        Загрузка интерактивной карты…
      </div>
    ),
  },
);

export function LocationPickerMap(props: LocationPickerProps) {
  return <LeafletPicker {...props} />;
}

import { ImageResponse } from "next/og";

import { BrandIconSvg } from "@/lib/brandIcon";

type IconSize = {
  width: number;
  height: number;
};

function renderIconArt(title?: string) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
      }}
    >
      <BrandIconSvg
        title={title}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}

export function createIconImageResponse(size: IconSize, title?: string) {
  return new ImageResponse(renderIconArt(title), size);
}
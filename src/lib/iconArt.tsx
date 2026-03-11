import { ImageResponse } from "next/og";

type IconSize = {
  width: number;
  height: number;
};

type IconGeometry = {
  outerRadius: number;
  frameInset: number;
  frameRadius: number;
  frameBorderWidth: number;
  horizontalBar: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  verticalBar: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  accentDot: {
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
};

const BRAND_GRADIENT = "linear-gradient(135deg, #ffd36d 0%, #54d4ff 100%)";

export const DEFAULT_ICON_GEOMETRY: IconGeometry = {
  outerRadius: 112,
  frameInset: 32,
  frameRadius: 84,
  frameBorderWidth: 2,
  horizontalBar: {
    top: 126,
    left: 128,
    width: 256,
    height: 52,
  },
  verticalBar: {
    top: 126,
    left: 230,
    width: 52,
    height: 262,
  },
  accentDot: {
    right: 118,
    bottom: 110,
    width: 46,
    height: 46,
  },
};

export const APPLE_ICON_GEOMETRY: IconGeometry = {
  outerRadius: 40,
  frameInset: 12,
  frameRadius: 32,
  frameBorderWidth: 1,
  horizontalBar: {
    top: 42,
    left: 45,
    width: 90,
    height: 18,
  },
  verticalBar: {
    top: 42,
    left: 81,
    width: 18,
    height: 92,
  },
  accentDot: {
    right: 42,
    bottom: 38,
    width: 18,
    height: 18,
  },
};

function renderIconArt(geometry: IconGeometry) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        borderRadius: geometry.outerRadius,
        background: "linear-gradient(145deg, #1e1e2e 0%, #09090b 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 20% 18%, rgba(255, 211, 109, 0.16), transparent 34%), radial-gradient(circle at 78% 82%, rgba(84, 212, 255, 0.2), transparent 30%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: geometry.frameInset,
          borderRadius: geometry.frameRadius,
          border: `${geometry.frameBorderWidth}px solid rgba(255,255,255,0.08)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: geometry.horizontalBar.top,
          left: geometry.horizontalBar.left,
          width: geometry.horizontalBar.width,
          height: geometry.horizontalBar.height,
          borderRadius: 999,
          background: BRAND_GRADIENT,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: geometry.verticalBar.top,
          left: geometry.verticalBar.left,
          width: geometry.verticalBar.width,
          height: geometry.verticalBar.height,
          borderRadius: 999,
          background: BRAND_GRADIENT,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: geometry.accentDot.right,
          bottom: geometry.accentDot.bottom,
          width: geometry.accentDot.width,
          height: geometry.accentDot.height,
          borderRadius: 999,
          background: "#54d4ff",
          opacity: 0.5,
        }}
      />
    </div>
  );
}

export function createIconImageResponse(size: IconSize, geometry: IconGeometry) {
  return new ImageResponse(renderIconArt(geometry), size);
}
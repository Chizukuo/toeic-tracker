import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          borderRadius: 40,
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
            inset: 12,
            borderRadius: 32,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 42,
            left: 45,
            width: 90,
            height: 18,
            borderRadius: 999,
            background: "linear-gradient(135deg, #ffd36d 0%, #54d4ff 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 42,
            left: 81,
            width: 18,
            height: 92,
            borderRadius: 999,
            background: "linear-gradient(135deg, #ffd36d 0%, #54d4ff 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 42,
            bottom: 38,
            width: 18,
            height: 18,
            borderRadius: 999,
            background: "#54d4ff",
            opacity: 0.5,
          }}
        />
      </div>
    ),
    size
  );
}
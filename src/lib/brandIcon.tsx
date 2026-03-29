import type { SVGProps } from "react";

type BrandIconSvgProps = SVGProps<SVGSVGElement> & {
  title?: string;
  idPrefix?: string;
};

export function BrandIconSvg({
  title,
  idPrefix = "toeic-deck-icon",
  ...props
}: BrandIconSvgProps) {
  const bgId = `${idPrefix}-bg`;
  const glowId = `${idPrefix}-glow`;
  const amberBloomId = `${idPrefix}-amber-bloom`;
  const cyanBloomId = `${idPrefix}-cyan-bloom`;

  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1e1e2e" />
          <stop offset="1" stopColor="#09090b" />
        </linearGradient>
        <linearGradient id={glowId} x1="140" y1="120" x2="372" y2="400" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffd36d" />
          <stop offset="0.48" stopColor="#ffbe5c" />
          <stop offset="1" stopColor="#54d4ff" />
        </linearGradient>
        <radialGradient id={amberBloomId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(102 92) rotate(90) scale(174)">
          <stop offset="0" stopColor="#ffd36d" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffd36d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={cyanBloomId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(399 399) rotate(90) scale(154)">
          <stop offset="0" stopColor="#54d4ff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#54d4ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="512" height="512" rx="112" fill={`url(#${bgId})`} />
      <circle cx="102" cy="92" r="174" fill={`url(#${amberBloomId})`} />
      <circle cx="399" cy="399" r="154" fill={`url(#${cyanBloomId})`} />
      <rect x="32" y="32" width="448" height="448" rx="84" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
      <rect x="128" y="126" width="256" height="52" rx="26" fill={`url(#${glowId})`} />
      <rect x="230" y="126" width="52" height="262" rx="26" fill={`url(#${glowId})`} />
      <circle cx="371" cy="379" r="23" fill="#54d4ff" opacity="0.5" />
    </svg>
  );
}
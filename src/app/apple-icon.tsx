import { APPLE_ICON_GEOMETRY, createIconImageResponse } from "@/lib/iconArt";

export const dynamic = "force-static";
export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return createIconImageResponse(size, APPLE_ICON_GEOMETRY);
}
import { createIconImageResponse, DEFAULT_ICON_GEOMETRY } from "@/lib/iconArt";

export const dynamic = "force-static";
export const size = {
  width: 512,
  height: 512,
};
export const contentType = "image/png";

export default function Icon() {
  return createIconImageResponse(size, DEFAULT_ICON_GEOMETRY);
}
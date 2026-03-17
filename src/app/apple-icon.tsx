import { createIconImageResponse } from "@/lib/iconArt";

export const dynamic = "force-static";
export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return createIconImageResponse(size, "TOEIC Deck apple icon");
}
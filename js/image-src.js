// Turns a stored image value into a safe <img> source, or null if it is missing or not a real image.
// Accepts raw Base64 (as the ACIM app saves it) or a data: URL. Only PNG, JPEG, WebP and GIF are allowed;
// SVG and anything else is rejected, so a submitted value can never run as a script.
const DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
const RAW_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function imageSrc(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().replace(/\s+/g, "");
  if (v.length < 100) return null;                       // too short to be a real image
  if (v.startsWith("data:")) return DATA_URL.test(v) ? v : null;
  if (!RAW_BASE64.test(v)) return null;
  const type = v.startsWith("iVBORw0KGgo") ? "png"
    : v.startsWith("/9j/") ? "jpeg"
    : v.startsWith("UklGR") ? "webp"
    : v.startsWith("R0lGOD") ? "gif" : null;
  return type ? `data:image/${type};base64,${v}` : null;
}
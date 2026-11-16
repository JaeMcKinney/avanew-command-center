// Contrast helpers, so a client's brand colour never produces unreadable text.

function channel(v: number): number {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Black or white, whichever reads better on the given background. */
export function readableOn(background: string): "#ffffff" | "#0b1c2b" {
  return contrast(background, "#ffffff") >= contrast(background, "#0b1c2b") ? "#ffffff" : "#0b1c2b"
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

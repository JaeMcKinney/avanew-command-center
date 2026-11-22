// Turns an uploaded logo (PNG, JPG, WebP or SVG) into a PNG no larger than
// the given box, which is the one format the logo store keeps.

export async function toPng(source: Blob | string, maxWidth: number, maxHeight: number): Promise<Blob> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source)
  try {
    const image = new Image()
    image.decoding = "async"
    image.src = url
    await image.decode()
    const width = image.naturalWidth || maxWidth
    const height = image.naturalHeight || maxHeight
    // Vector logos have no size of their own worth keeping, so they are drawn as large as the box allows.
    const vector = typeof source !== "string" ? source.type === "image/svg+xml" : /\.svg(\?|$)/.test(source)
    const scale = vector ? Math.min(maxWidth / width, maxHeight / height) : Math.min(1, maxWidth / width, maxHeight / height)
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("This browser could not prepare the image.")
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
    if (!blob) throw new Error("This browser could not prepare the image.")
    return blob
  } catch (err) {
    throw err instanceof Error && err.message.startsWith("This browser") ? err : new Error("That file could not be read as an image. Use a PNG, JPG, WebP or SVG.")
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url)
  }
}

/**
 * A logo centred in a see-through frame of exactly the given size, filling
 * nine tenths of it. This is the shape client logos are kept in, so the portal
 * header and the transcript letterhead can rely on it.
 */
export async function toFramedPng(file: Blob, width: number, height: number): Promise<Blob> {
  const fitted = await toPng(file, Math.round(width * 0.9), Math.round(height * 0.9))
  const bitmap = await createImageBitmap(fitted)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("This browser could not prepare the image.")
  // A small picture is scaled up to fill the frame the same way a large one is scaled down.
  const scale = Math.min((width * 0.9) / bitmap.width, (height * 0.9) / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(bitmap, (width - w) / 2, (height - h) / 2, w, h)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) throw new Error("This browser could not prepare the image.")
  return blob
}

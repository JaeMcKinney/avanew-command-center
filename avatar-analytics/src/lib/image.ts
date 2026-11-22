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

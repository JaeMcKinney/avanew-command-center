import { useMutation } from "@tanstack/react-query"
import { ImageUp } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { uploadClientLogo } from "@/lib/api"

// The saved logo is always this shape: wide enough for a wordmark, and the
// size the transcript letterhead and the portal header are drawn for.
const WIDTH = 900
const HEIGHT = 300
type Backdrop = "transparent" | "white" | "navy"
const FILLS: Record<Exclude<Backdrop, "transparent">, string> = { white: "#ffffff", navy: "#0b1c2b" }

/** Draws the logo as it will be saved. Shared by the preview and the final file. */
function paint(canvas: HTMLCanvasElement, image: CanvasImageSource & { width: number; height: number }, o: { zoom: number; x: number; y: number; backdrop: Backdrop; dropWhite: boolean }) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  const fit = Math.min(WIDTH / image.width, HEIGHT / image.height) * (o.zoom / 100)
  const w = image.width * fit
  const h = image.height * fit
  // x and y run from -100 to 100: how far the logo sits from the centre.
  const left = (WIDTH - w) / 2 + (o.x / 100) * (WIDTH / 2)
  const top = (HEIGHT - h) / 2 + (o.y / 100) * (HEIGHT / 2)
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(image, left, top, w, h)
  if (o.dropWhite) {
    // Turn a white (or near-white) box around the logo into see-through.
    const pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT)
    const d = pixels.data
    for (let i = 0; i < d.length; i += 4) {
      const lightest = Math.min(d[i], d[i + 1], d[i + 2])
      if (lightest >= 236) d[i + 3] = Math.round(d[i + 3] * Math.max(0, (255 - lightest) / 19))
    }
    ctx.putImageData(pixels, 0, 0)
  }
  if (o.backdrop !== "transparent") {
    ctx.globalCompositeOperation = "destination-over"
    ctx.fillStyle = FILLS[o.backdrop]
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.globalCompositeOperation = "source-over"
  }
}

/**
 * Upload a client's logo and tidy it before it is saved: size, position,
 * background, and removing a white box. The result is always a PNG.
 */
export function LogoEditor({ clientId, clientName, current, onSaved }: { clientId: string; clientName: string; current: string | null; onSaved: (url: string) => void }) {
  const id = useId()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(90)
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [backdrop, setBackdrop] = useState<Backdrop>("transparent")
  const [dropWhite, setDropWhite] = useState(false)
  const [problem, setProblem] = useState("")

  useEffect(() => {
    if (image && canvas.current) paint(canvas.current, image, { zoom, x, y, backdrop, dropWhite })
  }, [image, zoom, x, y, backdrop, dropWhite])

  const choose = (file: File | undefined) => {
    setProblem("")
    if (!file) return
    if (!/^image\/(png|jpeg|webp|svg\+xml|gif)$/.test(file.type)) return setProblem("Choose a PNG, JPG, SVG or WebP image.")
    if (file.size > 8 * 1024 * 1024) return setProblem("That file is over 8 MB. Choose a smaller one.")
    const url = URL.createObjectURL(file)
    const next = new Image()
    next.onload = () => {
      if (!next.width || !next.height) return setProblem("That image has no size. Try saving it as a PNG first.")
      setImage(next)
      setZoom(90); setX(0); setY(0); setDropWhite(false)
    }
    next.onerror = () => setProblem("That image could not be opened. Try a PNG or JPG.")
    next.src = url
  }

  const save = useMutation({
    mutationFn: async () => {
      const blob = await new Promise<Blob | null>((resolve) => canvas.current!.toBlob(resolve, "image/png"))
      if (!blob) throw new Error("The logo could not be prepared. Try another image.")
      return uploadClientLogo(clientId, blob)
    },
    onSuccess: (url) => { toast.success(`Logo saved for ${clientName}`); setImage(null); onSaved(url) },
    onError: (err) => toast.error((err as Error).message),
  })

  const slider = (key: string, label: string, value: number, set: (n: number) => void, min: number, max: number, unit: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      <input id={`${id}-${key}`} type="range" min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))} aria-valuetext={`${value}${unit}`} className="h-6 w-full accent-[var(--primary)]" />
    </div>
  )

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
      <div>
        <h3 id={`${id}-title`} className="text-base font-semibold">Logo</h3>
        <p className="text-sm text-muted-foreground">Shown at the top of {clientName}'s portal and on the right of their transcript letterhead. Upload any image and adjust it here; it is saved as a PNG.</p>
      </div>

      {current && !image && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">Current Logo</p>
          <div className="flex flex-wrap gap-3">
            <img src={current} alt={`${clientName} logo on a light background`} className="h-16 max-w-56 rounded-md border bg-white object-contain p-2" />
            <img src={current} alt={`${clientName} logo on a dark background`} className="h-16 max-w-56 rounded-md border bg-[#0b1c2b] object-contain p-2" />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-file`}>{current ? "Replace with a new image" : "Choose an image"}</Label>
        <input
          id={`${id}-file`} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
          onChange={(e) => choose(e.target.files?.[0])} aria-describedby={problem ? `${id}-problem` : undefined}
          className="min-h-11 max-w-md rounded-md border border-input bg-transparent text-sm file:mr-3 file:min-h-11 file:border-0 file:bg-secondary file:px-4 file:font-medium"
        />
        {problem && <p id={`${id}-problem`} role="alert" className="text-sm font-medium text-bad">{problem}</p>}
      </div>

      {image && (
        <>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">Preview</p>
            {/* The checked pattern shows through wherever the logo will be see-through. */}
            <div className="max-w-xl overflow-hidden rounded-md border bg-[repeating-conic-gradient(#d5dde3_0_25%,#f4f7f9_0_50%)] bg-[length:20px_20px]">
              <canvas ref={canvas} width={WIDTH} height={HEIGHT} role="img" aria-label={`Preview of the ${clientName} logo as it will be saved`} className="block h-auto w-full" />
            </div>
          </div>
          <div className="grid max-w-xl gap-4 sm:grid-cols-3">
            {slider("zoom", "Size", zoom, setZoom, 20, 250, " percent")}
            {slider("x", "Left to right", x, setX, -100, 100, "")}
            {slider("y", "Up and down", y, setY, -100, 100, "")}
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Background</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {([["transparent", "See-through (recommended)"], ["white", "White"], ["navy", "Dark navy"]] as const).map(([value, label]) => (
                <label key={value} className="flex min-h-8 items-center gap-2 text-sm">
                  <input type="radio" name={`${id}-backdrop`} value={value} checked={backdrop === value} onChange={() => setBackdrop(value)} className="size-4 accent-[var(--primary)]" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-start gap-3">
            <Checkbox id={`${id}-white`} className="mt-0.5 size-5" checked={dropWhite} onCheckedChange={(on) => setDropWhite(on === true)} />
            <div>
              <Label htmlFor={`${id}-white`}>Remove the white box around the logo</Label>
              <p className="text-xs text-muted-foreground">For logos saved on a white rectangle. Turns white areas see-through.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-10" disabled={save.isPending} onClick={() => save.mutate()}><ImageUp aria-hidden="true" />{save.isPending ? "Saving…" : "Save logo"}</Button>
            <Button variant="outline" className="min-h-10" disabled={save.isPending} onClick={() => setImage(null)}>Cancel</Button>
          </div>
        </>
      )}
    </section>
  )
}

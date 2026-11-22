// The moving backdrop for a brand that asks for one, after avanew.ai: two soft
// glows that wander behind every page, and, on the sign-in page only, voice
// lines. Work pages get the glows alone, so nothing moves behind a table
// someone is reading. Colours come from the brand's own highlight.

import { useEffect, useRef } from "react"
import { AVANEW_THEME, brand, mix } from "@/lib/brand"

export function BrandGlows() {
  return (
    <div aria-hidden="true" className="av-glows">
      <div className="av-glow av-glow-a" />
      <div className="av-glow av-glow-b" />
    </div>
  )
}

const fade = (color: string, opacity: number) => `${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`

/** Line colours from the brand's highlight, quiet enough that the form in front stays easy to read. */
function lineColors(highlight: string, text: string) {
  return {
    lines: [fade(highlight, 0.5), fade(highlight, 0.36), fade(mix(highlight, "#ffffff", 0.4), 0.28), fade(text, 0.13), fade(mix(highlight, "#000000", 0.2), 0.4), fade(highlight, 0.2)],
    echo: fade(highlight, 0.12),
    bars: fade(highlight, 0.1),
  }
}

// Each line: cycles across the screen, speed, phase, share of the height, width.
const WAVES = [
  { f: 1.6, s: 0.55, p: 0.0, a: 1.0, w: 2.0 },
  { f: 2.3, s: -0.42, p: 1.3, a: 0.78, w: 1.6 },
  { f: 3.1, s: 0.7, p: 2.1, a: 0.6, w: 1.4 },
  { f: 1.2, s: 0.3, p: 3.4, a: 0.9, w: 1.1 },
  { f: 4.2, s: -0.85, p: 0.7, a: 0.42, w: 1.2 },
  { f: 2.8, s: 0.25, p: 4.6, a: 0.7, w: 1.0 },
]

/** Layered sine lines that swell and settle like speech, over a row of quiet bars. */
export function VoiceWaves() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    // The sign-in card is always dark, so these are the dark version's colours.
    const dark = (brand().agency?.theme ?? AVANEW_THEME).dark
    const colors = lineColors(dark.highlight, dark.text)
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let width = 1
    let height = 1

    const band = (t: number, centre: number, amp: number, strokes: string[], scale: number) => {
      const step = Math.max(4, width / 220)
      WAVES.forEach((wave, k) => {
        ctx.beginPath()
        ctx.lineWidth = wave.w * scale
        ctx.strokeStyle = strokes[k % strokes.length]
        for (let x = 0; x <= width + step; x += step) {
          const u = x / width
          // Taper to nothing at both edges.
          const env = Math.sin(Math.PI * Math.min(1, Math.max(0, u))) ** 1.6 * (0.75 + 0.25 * Math.sin(u * 3.1 + t * 0.2))
          const y = centre + Math.sin(u * wave.f * 2 * Math.PI + t * wave.s * 2 + wave.p) * amp * wave.a * env + Math.sin(u * wave.f * 5.3 + t * 1.3 + k) * amp * 0.12 * env
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      })
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height)
      // Speech-like loudness: slow overlapping swells, never quite silent.
      const loud = Math.max(0.18, Math.min(1, 0.55 + 0.22 * Math.sin(t * 0.9) + 0.14 * Math.sin(t * 2.3 + 1.1) + 0.09 * Math.sin(t * 5.1 + 0.4)))
      const amp = Math.min(height * 0.14, 130) * (0.55 + 0.45 * loud)
      band(t, height * 0.6, amp, colors.lines, width < 700 ? 0.8 : 1)
      band(t * 0.7 + 7, height * 0.24, amp * 0.45, [colors.echo], 0.9)
      const count = Math.max(24, Math.round(width / 22))
      const slot = width / count
      ctx.fillStyle = colors.bars
      for (let i = 0; i < count; i++) {
        const u = i / (count - 1)
        const h = (0.25 + 0.75 * Math.abs(Math.sin(u * 9.7 + t * 1.6) * Math.sin(u * 3.3 - t * 0.7 + i * 0.37))) * Math.min(80, height * 0.1)
        ctx.fillRect(i * slot + slot * 0.3, height - h, slot * 0.4, h)
      }
    }

    const resize = () => {
      width = canvas.clientWidth || 1
      height = canvas.clientHeight || 1
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (still) draw(4.2)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    let frame = 0
    let start = 0
    let last = -1
    const tick = (now: number) => {
      if (!start) start = now
      // Half the site's pace, at 30 frames a second: movement you notice only if you look for it.
      const t = ((now - start) / 1000) * 0.5
      if (t - last > 1 / 60 && !document.hidden) {
        draw(t)
        last = t
      }
      frame = requestAnimationFrame(tick)
    }
    if (!still) frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="av-waves" />
}

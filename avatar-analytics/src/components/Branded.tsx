import { Fragment } from "react"
import App from "@/App"
import { BrandGlows } from "@/components/MotionBackdrop"
import { useBrand } from "@/lib/brand"

/**
 * The app under the brand in force. When the brand changes (someone signs in
 * to an agency, or signs out of one) the screens are drawn afresh, so every
 * name and logo on them is the right one.
 */
export function Branded() {
  const { agency, motion } = useBrand()
  return (
    <Fragment key={agency?.id ?? "divigner"}>
      {motion && <BrandGlows />}
      <App />
    </Fragment>
  )
}

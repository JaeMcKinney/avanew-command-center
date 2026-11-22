// One codebase, one build per company. `VITE_EDITION` picks whose name, logo
// and look the build wears. Unset, it is the Divigner edition.

import avanewOnDark from "@/assets/avanew-logo-on-dark.svg"
import avanewOnLight from "@/assets/avanew-logo-on-light.svg"
import divignerOnDark from "@/assets/divigner-logo-on-dark.webp"
import divignerOnLight from "@/assets/divigner-logo-on-light.webp"

export type EditionId = "divigner" | "avanew"

export type Edition = {
  id: EditionId
  /** The company as it is named in a sentence: "Ask Divigner to turn it on." */
  company: string
  /** The company's full name, for the logo's label and the footer. */
  companyFull: string
  logo: { onDark: string; onLight: string; width: number; height: number }
}

const EDITIONS: Record<EditionId, Edition> = {
  divigner: {
    id: "divigner",
    company: "Divigner",
    companyFull: "Divigner Group",
    logo: { onDark: divignerOnDark, onLight: divignerOnLight, width: 626, height: 200 },
  },
  avanew: {
    id: "avanew",
    company: "Avanew",
    companyFull: "Avanew",
    logo: { onDark: avanewOnDark, onLight: avanewOnLight, width: 333, height: 114 },
  },
}

export function editionFor(value: string | undefined): Edition {
  return value === "avanew" ? EDITIONS.avanew : EDITIONS.divigner
}

export const EDITION = editionFor(import.meta.env.VITE_EDITION)
export const COMPANY = EDITION.company

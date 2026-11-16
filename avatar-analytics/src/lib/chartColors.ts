// Series colours for charts: a fixed order of eight hues, checked for
// colour-blind separation on this app's light and dark card surfaces. The
// colour belongs to the avatar's position in the client's list, so it does not
// change when the date range does. A ninth series folds into "Other".

export const SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
export const SERIES_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"]
export const OTHER_LIGHT = "#8796a3"
export const OTHER_DARK = "#7f93a3"
export const MAX_SERIES = SERIES_LIGHT.length

/** CSS for one series colour that follows the theme. */
export function seriesColor(index: number): string {
  if (index < 0 || index >= MAX_SERIES) return `light-dark(${OTHER_LIGHT}, ${OTHER_DARK})`
  return `light-dark(${SERIES_LIGHT[index]}, ${SERIES_DARK[index]})`
}

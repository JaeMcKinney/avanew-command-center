// The company this deployment belongs to, as it signs emails and texts. Each
// edition runs on its own project and sets BRAND_NAME there; unset, it is Divigner.

export const brandName = () => Deno.env.get("BRAND_NAME")?.trim() || "Divigner"

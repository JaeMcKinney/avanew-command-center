// Where an export can go after it is built: the device's share sheet, a
// private link, the person's own inbox, Dropbox or Google Drive.

import { asFile, type ExportFile } from "@/lib/exportFiles"
import { callFunction, supabase } from "@/lib/supabase"

const DROPBOX_APP_KEY = import.meta.env.VITE_DROPBOX_APP_KEY as string | undefined
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export const dropboxAvailable = Boolean(DROPBOX_APP_KEY)
export const googleDriveAvailable = Boolean(GOOGLE_CLIENT_ID)

export type ExportOptions = { email: boolean; link_days: number }
export type ExportLink = { url: string; expires_at: string; emailed_to: string | null }

export function exportOptions(): Promise<ExportOptions> {
  return callFunction<ExportOptions>("export-share", { action: "options" })
}

/** Puts the file in the private exports folder and returns where it is. */
export async function uploadExport(clientId: string, userId: string, file: ExportFile): Promise<string> {
  const path = `${clientId}/${userId}/${crypto.randomUUID()}/${file.filename}`
  const { error } = await supabase.storage.from("exports").upload(path, asFile(file), { contentType: file.type })
  if (error) throw new Error(/exceeded|too large/i.test(error.message) ? "This export is too large to send. Choose fewer conversations, or download it instead." : "The file could not be prepared for sharing. Try again.")
  return path
}

export const createLink = (path: string) => callFunction<ExportLink>("export-share", { action: "link", path })
export const emailToMe = (path: string) => callFunction<ExportLink>("export-share", { action: "email", path })

/** True when this device can hand the file to its own share sheet (most phones, and some desktops). */
export function canShareFile(file: ExportFile): boolean {
  try {
    return typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [asFile(file)] })
  } catch {
    return false
  }
}

/** Opens the device's share sheet. Returns false if the person closed it without sharing. */
export async function shareFile(file: ExportFile, title: string): Promise<boolean> {
  try {
    await navigator.share({ files: [asFile(file)], title })
    return true
  } catch (err) {
    if ((err as Error).name === "AbortError") return false
    throw new Error("This device could not share the file. Download it instead.", { cause: err })
  }
}

function loadScript(src: string, id: string, attributes: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) return resolve()
    const script = document.createElement("script")
    script.src = src
    script.id = id
    for (const [key, value] of Object.entries(attributes)) script.setAttribute(key, value)
    script.onload = () => resolve()
    script.onerror = () => { script.remove(); reject(new Error("Could not load the connection. Check your internet connection or ad blocker and try again.")) }
    document.head.append(script)
  })
}

type DropboxSaver = { save: (url: string, filename: string, options: { success?: () => void; cancel?: () => void; error?: (message: string) => void }) => void }
type GoogleAccounts = { oauth2: { initTokenClient: (config: { client_id: string; scope: string; callback: (response: { access_token?: string; error?: string }) => void; error_callback?: (error: { type: string }) => void }) => { requestAccessToken: () => void } } }
declare global {
  interface Window { Dropbox?: DropboxSaver; google?: { accounts: GoogleAccounts } }
}

/** Dropbox fetches the file from its private link and saves it to the folder the person picks. */
export async function saveToDropbox(url: string, filename: string): Promise<"saved" | "cancelled"> {
  if (!DROPBOX_APP_KEY) throw new Error("Dropbox is not set up yet.")
  await loadScript("https://www.dropbox.com/static/api/2/dropins.js", "dropboxjs", { "data-app-key": DROPBOX_APP_KEY })
  const dropbox = window.Dropbox
  if (!dropbox) throw new Error("Dropbox could not be opened. Try again.")
  return new Promise((resolve, reject) => {
    dropbox.save(url, filename, {
      success: () => resolve("saved"),
      cancel: () => resolve("cancelled"),
      error: () => reject(new Error("Dropbox could not save the file. Try again, or download it instead.")),
    })
  })
}

/** Asks Google for permission to add files (and nothing else), then uploads the file to the person's Drive. */
export async function saveToGoogleDrive(file: ExportFile): Promise<"saved" | "cancelled"> {
  if (!GOOGLE_CLIENT_ID) throw new Error("Google Drive is not set up yet.")
  await loadScript("https://accounts.google.com/gsi/client", "google-identity")
  const google = window.google
  if (!google) throw new Error("Google could not be opened. Try again.")
  const token = await new Promise<string | null>((resolve, reject) => {
    google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      // drive.file: this app can only see files it creates itself, never the rest of the Drive.
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (response) => (response.access_token ? resolve(response.access_token) : response.error === "access_denied" ? resolve(null) : reject(new Error("Google did not give permission to save the file."))),
      error_callback: (error) => (error.type === "popup_closed" ? resolve(null) : reject(new Error("The Google sign-in window could not open. Allow pop-ups for this site and try again."))),
    }).requestAccessToken()
  })
  if (!token) return "cancelled"

  const body = new FormData()
  body.append("metadata", new Blob([JSON.stringify({ name: file.filename, mimeType: file.type })], { type: "application/json" }))
  body.append("file", asFile(file))
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body,
  }).catch(() => null)
  if (!res?.ok) throw new Error("Google Drive could not save the file. Try again, or download it instead.")
  return "saved"
}

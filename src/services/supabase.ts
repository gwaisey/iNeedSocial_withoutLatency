import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { SessionReportPayload } from "../types/social"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ""
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ""

let cachedClient: SupabaseClient | null = null

function getSupabaseConfigMessage(): string | null {
  if (!supabaseUrl) {
    return "Penyimpanan Supabase dinonaktifkan karena VITE_SUPABASE_URL belum diatur."
  }

  try {
    new URL(supabaseUrl)
  } catch {
    return "Penyimpanan Supabase dinonaktifkan karena VITE_SUPABASE_URL tidak valid."
  }

  if (!supabaseKey) {
    return "Penyimpanan Supabase dinonaktifkan karena VITE_SUPABASE_PUBLISHABLE_KEY belum diatur."
  }

  return null
}

const supabaseConfigError = getSupabaseConfigMessage()

function getSupabaseClient(): SupabaseClient {
  if (supabaseConfigError) {
    throw new Error(supabaseConfigError)
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseKey)
  }

  return cachedClient
}

export function getSupabaseStatusMessage() {
  return supabaseConfigError
}

export async function saveSessionData(payload: SessionReportPayload) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("feed_sessions")
    .insert([payload])
    .select()

  if (error) {
    throw error
  }

  return data
}

export async function downloadSelfReport(payload: SessionReportPayload) {
  const XLSX = await import("xlsx")
  const worksheet = XLSX.utils.json_to_sheet([payload])
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Sesi Saya")

  const filename = `Laporan_Sesi_Saya_${new Date().toISOString().split("T")[0]}.xlsx`
  XLSX.writeFile(workbook, filename)
}

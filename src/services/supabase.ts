import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveSessionData(payload: {
  timestamp: string
  session_id: string
  total_time: number
  humor_ms: number
  berita_ms: number
  wisata_ms: number
  makanan_ms: number
  olahraga_ms: number
  game_ms: number
  app_version: string
}) {
  console.log('📤 Saving to Supabase:', payload)
  
  try {
    const { data, error } = await supabase
      .from('feed_sessions')
      .insert([payload])
      .select()

    if (error) {
      console.error('❌ Supabase error:', error.message)
      throw error
    }

    console.log('✅ Data saved successfully to Supabase!')
    console.log('Row data:', data)
    return data
  } catch (error) {
    console.error('❌ Failed to save:', error)
    throw error
  }
}

export async function downloadAllReports() {
  console.log('📊 Fetching all reports for export...')
  try {
    const { data, error } = await supabase
      .from('feed_sessions')
      .select('*')
      .order('timestamp', { ascending: false })

    if (error) throw error

    if (!data || data.length === 0) {
      alert('No data found in database yet.')
      return
    }

    // Convert to Excel
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'User Reports')

    // Generate filename
    const filename = `User_Reports_${new Date().toISOString().split('T')[0]}.xlsx`

    // Download
    XLSX.writeFile(workbook, filename)
    console.log('✅ Excel report downloaded!')
  } catch (error) {
    console.error('❌ Export failed:', error)
    alert('Failed to export data. Check console for details.')
  }
}

export function downloadSelfReport(payload: any) {
  console.log('📄 Generating self report...')
  try {
    const data = [payload]
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'My Session Report')

    const filename = `My_Social_Report_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(workbook, filename)
    console.log('✅ Self report downloaded!')
  } catch (error) {
    console.error('❌ Individual export failed:', error)
  }
}
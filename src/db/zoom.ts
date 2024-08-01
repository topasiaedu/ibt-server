import { Database } from '../database.types'
import supabase from './supabaseClient'

export type Zoom = Database['public']['Tables']['zoom']['Row']
export type ZoomUpdate = Database['public']['Tables']['zoom']['Update']

export const fetchZoom = async (zoomId: number): Promise<Zoom> => {
  const { data, error } = await supabase
    .from('zoom')
    .select('*')
    .eq('zoom_id', zoomId)
    .single()

  if (error) throw error
  return data as Zoom
}

export const fetchZoomByProjectId = async (
  projectId: number
): Promise<Zoom> => {
  const { data, error } = await supabase
    .from('zoom')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (error) throw error
  return data as Zoom
}


export const updateZoom = async (
  zoomId: string,
  update: ZoomUpdate
): Promise<Zoom> => {
  const { data, error } = await supabase
    .from('zoom')
    .update(update)
    .eq('zoom_id', zoomId)
    .single()

  if (error) throw error
  return data as Zoom
}
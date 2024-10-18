import supabase from './supabaseClient'
import { Database } from '../database.types'

export type PhoneNumber = Database['public']['Tables']['phone_numbers']['Row']
export type PhoneNumberInsert =
  Database['public']['Tables']['phone_numbers']['Insert']
export type PhoneNumberUpdate =
  Database['public']['Tables']['phone_numbers']['Update']

export const fetchPhoneNumber = async (
  phoneNumberId: number
): Promise<PhoneNumber> => {
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('phone_number_id', phoneNumberId)
    .single()
  if (error) throw error
  return data
}

export const fetchPhoneNumberByNumber = async (
  phoneNumber: string
): Promise<PhoneNumber> => {
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('number', phoneNumber)
    .neq('quality_rating', 'UNKNOWN')
    .single()
  if (error) throw error
  return data
}

export const fetchPhoneNumberBMAccessTokenByNumber = async (
  phoneNumber: string
): Promise<string> => {
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*, whatsapp_business_accounts(*, business_manager(*))')
    .eq('number', phoneNumber)
    .single()
  if (error) throw error
  return data.whatsapp_business_accounts.business_manager.access_token
}

export const fetchPhoneNumberByWABAId = async (
  wabaId: string
): Promise<PhoneNumber> => {
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('waba_id', wabaId)
    .single()
  if (error) throw error
  return data
}

export const fetchPhoneNumberByWAId = async (
  waId: string
): Promise<PhoneNumber> => {
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('wa_id', waId)
    .single()
  if (error) {
    console.error('Error fetching phone number by wa_id:', waId)
    throw error
  }
  return data
}

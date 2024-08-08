import supabase  from "./supabaseClient";
import { Database } from "../database.types";

export type PhoneNumber = Database['public']['Tables']['phone_numbers']['Row']
export type PhoneNumberInsert = Database['public']['Tables']['phone_numbers']['Insert']
export type PhoneNumberUpdate = Database['public']['Tables']['phone_numbers']['Update']

export const fetchPhoneNumber = async (phoneNumberId: number): Promise<PhoneNumber> => {
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('phone_number_id', phoneNumberId)
    .single()
  if (error) throw error
  return data
}

export const fetchPhoneNumberByNumber = async (phoneNumber: string): Promise<PhoneNumber> => {
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('number', phoneNumber)
    .single()
  if (error) throw error
  return data
}
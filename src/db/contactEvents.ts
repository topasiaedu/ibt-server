import { Database } from "../database.types";
import supabase from "./supabaseClient";

export type ContactEvent = Database["public"]["Tables"]["contact_events"]["Row"];
export type ContactEventInsert = Database["public"]["Tables"]["contact_events"]["Insert"];
export type ContactEventUpdate = Database["public"]["Tables"]["contact_events"]["Update"];

export const fetchContactEvents = async (
  contactId: number
): Promise<ContactEvent[]> => {
  const { data, error } = await supabase
    .from("contact_events")
    .select("*")
    .eq("contact_id", contactId);
  if (error) throw error;
  return data as ContactEvent[];
}

export const createContactEvent = async (
  contactEvent: ContactEventInsert
): Promise<ContactEvent> => {
  const { data, error } = await supabase
    .from("contact_events")
    .insert([contactEvent]);
  if (error) throw error;
  return data![0] as ContactEvent;
}

export const updateContactEvent = async (
  contactEvent: ContactEventUpdate
): Promise<ContactEvent> => {
  const { data, error } = await supabase
    .from("contact_events")
    .update(contactEvent)
    .eq("id", contactEvent.id);
  if (error) throw error;
  return data![0] as ContactEvent;
}

export const deleteContactEvent = async (
  contactEventId: number
): Promise<void> => {
  const { error } = await supabase
    .from("contact_events")
    .delete()
    .eq("id", contactEventId);
  if (error) throw error;
}
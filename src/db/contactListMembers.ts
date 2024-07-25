import { Database } from "../database.types";
import supabase from "./supabaseClient";

export type ContactListMembersInsert = Database["public"]["Tables"]["contact_list_members"]["Insert"];
export type ContactListMembers = Database["public"]["Tables"]["contact_list_members"]["Row"];

export const insertContactListMembers = async (
  contactListMembers: ContactListMembersInsert[]
) => {
  const { error } = await supabase
    .from("contact_list_members")
    .insert(contactListMembers);
  if (error) throw error;
};

export const fetchContactListMembers = async (
  contactListId: number
): Promise<ContactListMembers[]> => {
  const { data, error } = await supabase
    .from("contact_list_members")
    .select("*")
    .eq("contact_list_id", contactListId);
  if (error) throw error;
  return data as ContactListMembers[];
};
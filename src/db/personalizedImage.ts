import { Database } from "../database.types";
import supabase from "./supabaseClient";

export type PersonalizedImage = Database["public"]["Tables"]["personalized_images"]["Row"];

export const fetchPersonalizedImage = async (
  personalizedImageId: string
): Promise<PersonalizedImage> => {
  const { data, error } = await supabase
    .from("personalized_images")
    .select("*")
    .eq("id", personalizedImageId)
    .single();

  if (error)
    throw new Error(
      `Failed to fetch personalized image with ID ${personalizedImageId}: ${error.message}`
    );
  return data as PersonalizedImage;
};
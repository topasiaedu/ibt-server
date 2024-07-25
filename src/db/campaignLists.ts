import { Database } from "../database.types";
import supabase from "./supabaseClient";

export type CampaignList = Database["public"]["Tables"]["campaign_lists"]["Row"];
export type CampaignListInsert = Database["public"]["Tables"]["campaign_lists"]["Insert"];

export const fetchCampaignList = async (
  campaignId: number
): Promise<CampaignList[]> => {
  const { data, error } = await supabase
    .from("campaign_lists")
    .select("*")
    .eq("campaign_id", campaignId);
  if (error) throw error;
  return data as CampaignList[];
}
import supabase  from '../../db/supabaseClient';

export const fetchAndLogCampaigns = async (): Promise<void> => {
    let { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('*');

    if (error) {
        console.error('Error fetching campaigns:', error);
        return;
    }

    if (campaigns) {
        campaigns.forEach((campaign) => {
            console.log(`Campaign: ${campaign.name}`);
            // Here you would have your logic to send data to WhatsApp API
        });
    }
};

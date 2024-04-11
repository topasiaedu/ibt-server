import supabase from '../db/supabaseClient';
import { fetchTemplatesService } from '../api/whatsapp';
import { logError } from '../utils/errorLogger';
import { CronJob } from 'cron';

const fetchTemplates = async () => {
  const wabaIds = await supabase
    .from('whatsapp_business_accounts')
    .select('waba_id, account_id');

  if (!wabaIds) {
    console.log('No WhatsApp Business Accounts found');
    return;
  }

  if (!wabaIds.data) {
    console.log('No WhatsApp Business Accounts found');
    return;
  }

  for (const wabaId of wabaIds.data) {
    const { data: templates } = await fetchTemplatesService(wabaId.waba_id);

    if (!templates) {
      console.log('No templates found for WABA ID: ' + wabaId);
      continue;
    }

    // Check if the template exists in the database using the id against wa_template_id
    // If it exists, update the record
    // If it doesn't exist, insert the record
    // For both insert or update, it should update all three tables: templates, components, buttons
    for (const template of templates.data) {
      const { id } = template;

      const { data: existingTemplate, error } = await supabase
        .from('templates')
        .select('wa_template_id')
        .eq('wa_template_id', id)
        .single();

      if (existingTemplate && existingTemplate.wa_template_id === id) {
        const { name, language, status, category } = template;
        // Template Table
        const { data: updatedTemplate, error: updateError } = await supabase
          .from('templates')
          .update({
            name,
            language,
            status,
            category,
            account_id: wabaId.account_id,
            components: {
              data: template.components
            }
          })
          .eq('wa_template_id', id)
          .single();

        if (updateError) {
          logError(updateError as unknown as Error, 'Error updating template in database. Template ID: ' + id + '\n');
        }

      } else {
        const { name, language, status, category } = template;
        // Template Table
        const { data: newTemplate, error: insertError } = await supabase
          .from('templates')
          .insert({
            name,
            language,
            status,
            category,
            wa_template_id: id,
            account_id: wabaId.account_id,
            components: {
              data: template.components
            }
          });

        if (insertError) {
          logError(insertError as unknown as Error, 'Error inserting template in database. Template ID: ' + id + '\n');
          console.log('Error inserting template in database. Template ID: ' + id + '\n');
          continue;
        }
      }

    }
  }
}

export const fetchTemplatesJob = new CronJob('*/60 * * * * *', fetchTemplates); // Run every second

// Database Schema:
// templates
// - account_id: number | null
// - category: string
// - components: Json | null
// - created_at: string | null
// - language: string
// - name: string
// - rejection_reason: string | null
// - status: string
// - template_id: number
// - wa_template_id: string | null


// Example Incoming Response:
// {
// 	"data": [
// 		{
// 			"name": "sg_cxen_tonight",
// 			"components": [
// 				{
// 					"type": "HEADER",
// 					"format": "IMAGE",
// 					"example": {
// 						"header_handle": [
// 							"https:\/\/scontent.whatsapp.net\/v\/t61.29466-34\/394531429_1186904022692436_3382934977132879410_n.jpg?ccb=1-7&_nc_sid=8b1bef&_nc_ohc=51ZcEZbrZbwAb49OjQY&_nc_ht=scontent.whatsapp.net&edm=AH51TzQEAAAA&oh=01_ASCzjfxbZYWd1czBR4r68IoLBfVwBnmccZ6jnZkSexDvNA&oe=663E7952"
// 						]
// 					}
// 				},
// 				{
// 					"type": "BODY",
// 					"text": "*Tonight 7:45pm* ‼️ Reverse Your Diabetes & Other Health Complications (High blood Pressure)\n\n❌ No more 💊 medications \n❌ No more 💉 insulins \n\nDr. Andrew & Dr. Jasmine will  reveal more correct info to you in Tonight’s LIVE Diabetes Workshop:\n\n🧡 Time: 7:45PM (Starts on time at 8PM)\n🧡 Date: TONIGHT\n🧡 Ticket Fee: FREE (Your ticket is sponsored by us😉)\n\nLIVE Online Workshop Link: https:\/\/www.clinixero.co\/zoom-en-sg\n\nReply【YES】to confirm your attendance for tonight, as our Zoom room has slot limitations. \n\nSee you Tonight around 7:45PM . Thank you \n🤗Click button \"join cxen sg\" to get join in group, receive latest info\n😇Click button \"join cxen sg live\" to  join in zoom\n🛟Click button \"Unsubsribe Clinixero (EN)\" if you do not widh to receive any messsage anymore."
// 				},
// 				{
// 					"type": "BUTTONS",
// 					"buttons": [
// 						{
// 							"type": "QUICK_REPLY",
// 							"text": "join cxen sg"
// 						},
// 						{
// 							"type": "QUICK_REPLY",
// 							"text": "join cxen sg live"
// 						},
// 						{
// 							"type": "QUICK_REPLY",
// 							"text": "Unsubsribe Clinixero (EN)"
// 						}
// 					]
// 				}
// 			],
// 			"language": "en_US",
// 			"status": "APPROVED",
// 			"category": "MARKETING",
// 			"id": "1186904019359103"
// 		},
// 		{
// 			"name": "sg_cxen_joinnow",
// 			"components": [
// 				{
// 					"type": "HEADER",
// 					"format": "IMAGE",
// 					"example": {
// 						"header_handle": [
// 							"https:\/\/scontent.whatsapp.net\/v\/t61.29466-34\/394190606_403055095839574_3606201554605097077_n.png?ccb=1-7&_nc_sid=8b1bef&_nc_ohc=4sfRXHQrgygAb4jJqBy&_nc_ht=scontent.whatsapp.net&edm=AH51TzQEAAAA&oh=01_ASCtzW35Kl8VTDnTp_1ovpy8Cq9n2q9tyoVGraB0CxyAVQ&oe=663E6236"
// 						]
// 					}
// 				},
// 				{
// 					"type": "BODY",
// 					"text": "⚡️ *Diabetes Ends Here - Act Now* ! ⚡️\n\n👨🏻‍⚕️👩🏻‍⚕️ Live diabetes information shared by reversing diabetes expert doctors🚨 Don't Miss It!\n\nJoin In Zoom Now If You Haven't\n🧡 Click to join the live broadcast: \nhttps:\/\/www.clinixero.co\/zoom-en-sg\n\nIf you haven't joined yet, you may join in and learn yea.\n\n🧡 *Share this and help more people 🧡 Save more lives*\n\nIf you've join in Zoom successfully, reply with 【zoom】"
// 				},
// 				{
// 					"type": "BUTTONS",
// 					"buttons": [
// 						{
// 							"type": "QUICK_REPLY",
// 							"text": "I need zoom guide"
// 						},
// 						{
// 							"type": "QUICK_REPLY",
// 							"text": "I got enquiries"
// 						}
// 					]
// 				}
// 			],
// 			"language": "en_US",
// 			"status": "APPROVED",
// 			"category": "MARKETING",
// 			"id": "403055089172908"
// 		},
// 		{
// 			"name": "cxen_joinnow_march2024",
// 			"components": [
// 				{
// 					"type": "HEADER",
// 					"format": "IMAGE",
// 					"example": {
// 						"header_handle": [
// 							"https:\/\/scontent.whatsapp.net\/v\/t61.29466-34\/421307015_3583052625290771_5663026653388766863_n.png?ccb=1-7&_nc_sid=8b1bef&_nc_ohc=qGQKu7HGZg4Ab4yK5n3&_nc_ht=scontent.whatsapp.net&edm=AH51TzQEAAAA&oh=01_ASCZOPPLpe-mVFED5F9JY8_0y9SFbsYvbw-BHHob3mntoQ&oe=663E6F76"
// 						]
// 					}
// 				},
// 				{
// 					"type": "BODY",
// 					"text": "🔴 *Join now* !🔴\nExpert doctors specializing in reversing diabetes will reveal how to use natural remedies to cure your diabetes! Learn the 5 steps to deal with diabetes that has been bothering you for many years (based on real case studies).\n\n*Effectively, safely, and efficiently resolve the difficult and complicated diseases caused by diabetes.*\n\n✨Tonight from 7:45 PM to 10:30 PM!\n✨ Zoom Link:\nhttps:\/\/www.clinixero.co\/zoom-en\n\nIf you're already inside, reply [in].\nIf you need assistance, reply [help]."
// 				},
// 				{
// 					"type": "BUTTONS",
// 					"buttons": [
// 						{
// 							"type": "QUICK_REPLY",
// 							"text": "join cxen"
// 						},
// 						{
// 							"type": "QUICK_REPLY",
// 							"text": "join cxen live"
// 						},
// 						{
// 							"type": "QUICK_REPLY",
// 							"text": "Unsubsribe Clinixero (EN)"
// 						}
// 					]
// 				}
// 			],
// 			"language": "en_US",
// 			"status": "APPROVED",
// 			"category": "MARKETING",
// 			"id": "3583052621957438"
// 		},
// 		{
// 			"name": "tonight_soon_march2024",
// 			"components": [
// 				{
// 					"type": "HEADER",
// 					"format": "IMAGE",
// 					"example": {
// 						"header_handle": [
// 							"https:\/\/scontent.whatsapp.net\/v\/t61.29466-34\/361674508_763147599103258_4962623395527300912_n.png?ccb=1-7&_nc_sid=8b1bef&_nc_ohc=PoSmLr_QQJ8Ab6ZjabT&_nc_ht=scontent.whatsapp.net&edm=AH51TzQEAAAA&oh=01_ASDLFYqhBE6u_Gmb4dd29cGA6Z5Vky3rnk8qBoeum-6qgA&oe=663E84F5"
// 						]
// 					}
// 				},
// 				{
// 					"type": "BODY",
// 					"text": "*Is Diabetes Reversable?* \nStay tuned for the ✨【Live Diabetes Workshop】\n✅ We'll unveil the most effective secrets to combat diabetes!\n✅ Learn how to stabilize blood sugar levels!\n✅ Discover how to truly avoid diabetes complications.\n\n🌟 *Tonight from 7:45 PM to 10:00 PM*\n🌟 Class link: https:\/\/www.clinixero.co\/zoom-en\n🌟 Presenters: 2 diabetes reversal expert doctors\n\nIf you encounter any issues, please feel free to inform me as well! 😬\n\nTo confirm your attendance, please reply [YES] to reserve your seat!"
// 				},
// 				{
// 					"type": "BUTTONS",
// 					"buttons": [
// 						{
// 							"type": "QUICK_REPLY",
// 							"text": "join cxen"
// 						}
// 					]
// 				}
// 			],
// 			"language": "en_US",
// 			"status": "APPROVED",
// 			"category": "MARKETING",
// 			"id": "763147595769925"
// 		}
// 	],
// 	"paging": {
// 		"cursors": {
// 			"before": "MAZDZD",
// 			"after": "MjQZD"
// 		}
// 	}
// }
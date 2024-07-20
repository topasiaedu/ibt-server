import { Database } from "../../../database.types"
import supabase from "../../../db/supabaseClient";
import { logError } from "../../../utils/errorLogger";

export const addToContactList = async (payload: any, workflowLogId: string) => {
  console.log("Payload", payload);
  const { contact_list_id, contact_id } = payload;

  const { data: contactListMember, error: contactListMemberError } = await supabase
    .from('contact_list_members')
    .insert([
      {
        contact_list_id,
        contact_id
      }
    ]);

  if (contactListMemberError) {
    console.error('Error adding contact to contact list:', contactListMemberError);
    logError(contactListMemberError as unknown as Error, 'Error adding contact to contact list');
    return;
  }

  // Update workflow log status to completed
  const { data: updatedWorkflowLogStatus, error: updateStatusError } = await supabase
    .from('workflow_logs')
    .update({ status: 'COMPLETED' })
    .eq('id', workflowLogId);
  
}
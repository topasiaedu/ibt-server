// cronJobs/processWorkflowLogs.ts
import supabase from '../../../db/supabaseClient'
import { logError } from '../../../utils/errorLogger'
import { Action } from '../../../db/action'
import { Contact } from '../../../db/contacts'
import { Template } from '../../../db/templates'

export const generateWorkflowLog = async (action: Action, contact: Contact) => {
  let payload = {};
  let action_time = new Date();

  // If type = delay, then wait the specified amount of time before continuing
  if (action.type === 'delay') {
    const delayDetails = action.details as { delay?: number };
    
    // If delay is specified, wait for the delay (assuming delay is in seconds)
    const delay = delayDetails.delay ?? 0; // Default to 0 if no delay is provided
    console.log(`Delaying next action by ${delay} seconds...`);

    await new Promise(resolve => setTimeout(resolve, delay * 1000)); // Convert delay from seconds to milliseconds

    console.log('Delay finished, continuing to the next action...');
    return;
  }

  switch (action.type) {
    case 'add-to-contact-list':
      const addToContactListDetails = action.details as {
        listId?: string
        listIds?: string[]
        currentIndex?: number
      }
      if (addToContactListDetails.listId) {
        // Legacy code
        payload = {
          contact_list_id: addToContactListDetails.listId,
          contact_id: contact.contact_id,
          workflow_id: action.workflow_id,
        }
      } else if (addToContactListDetails.listIds) {
        const index = addToContactListDetails.currentIndex || 0
        const listLength = addToContactListDetails.listIds.length
        // Loop through the list of listIds
        payload = {
          contact_list_id: addToContactListDetails.listIds[index % listLength],
          contact_id: contact.contact_id,
          workflow_id: action.workflow_id,
          current_index: addToContactListDetails.currentIndex,
        }
      }
      break
    case 'send-message':
      const sendMessageDetails = action.details as {
        message?: string
        postTime?: string
        timePostType?: string
        postDate?: Date
      }
      payload = {
        message: sendMessageDetails.message,
        contact_id: contact.contact_id,
        workflow_id: action.workflow_id,
        postTime: sendMessageDetails.postTime,
        timePostType: sendMessageDetails.timePostType,
        postDate: sendMessageDetails.postDate,
      }

      if (
        sendMessageDetails.timePostType !== 'immediately' &&
        sendMessageDetails.postTime! &&
        sendMessageDetails.postDate!
      ) {
        // Example postDate: '2022-01-01T00:00:00.000Z'
        // Example postTime: '12:00'
        action_time = new Date(
          sendMessageDetails.postDate + 'T' + sendMessageDetails.postTime
        )
      } else {
        action_time = new Date()
      }
      break
    case 'send-template':
      const sendTemplateDetails = action.details as {
        selectedTemplate?: Template | null
        templatePayload?: JSON
        timePostType?: string
        postTime?: string
        postDate?: Date,
        personalizedImageId?: string
        imageType?: string
      }

      payload = {
        selected_template: sendTemplateDetails.selectedTemplate,
        template_payload: sendTemplateDetails.templatePayload,
        contact_id: contact.contact_id,
        workflow_id: action.workflow_id,
        personalizedImageId: sendTemplateDetails.personalizedImageId,
        imageType: sendTemplateDetails.imageType,
      }

      if (
        sendTemplateDetails.timePostType !== 'immediately' &&
        sendTemplateDetails.postTime! &&
        sendTemplateDetails.postDate!
      ) {
        // Example postDate: '2022-01-01T00:00:00.000Z'
        // Example postTime: '12:00'
        action_time = new Date(
          sendTemplateDetails.postDate + 'T' + sendTemplateDetails.postTime
        )
      } else {
        action_time = new Date()
      }
      break

    case 'zoom':
      const zoomDetails = action.details as {
        meetingId?: string
      }
      payload = {
        meeting_id: zoomDetails.meetingId,
        project_id: contact.project_id,
        email: contact.email,
        first_name: contact.name,
        last_name: contact.name,
      }
      break
    default:
      break
  }

  const { data: newWorkflowLog, error: newWorkflowLogError } = await supabase
    .from('workflow_logs')
    .insert([
      {
        action_id: action.id,
        status: 'PENDING',
        payload,
        action_time,
        type: action.type,
      },
    ])
    .select('*')
    .single()

  if (newWorkflowLogError) {
    logError(
      newWorkflowLogError as unknown as Error,
      'Error creating new workflow log'
    )
    console.log('Error creating new workflow log:', newWorkflowLogError)
    return
  }
  return newWorkflowLog
}

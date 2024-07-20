// cronJobs/processWorkflowLogs.ts
import supabase from '../../../db/supabaseClient'
import { logError } from '../../../utils/errorLogger'
import { Database } from '../../../database.types'
import { Request, Response } from 'express'

type WorkflowLog = Database['public']['Tables']['campaigns']['Row']
type Contact = Database['public']['Tables']['contacts']['Row']
type Workflow = Database['public']['Tables']['workflows']['Row']
type Trigger = Database['public']['Tables']['triggers']['Row']
type Action = Database['public']['Tables']['actions']['Row']
type Template = Database['public']['Tables']['templates']['Row']

export const generateWorkflowLog = async (action: Action, contact: Contact) => {
  let payload = {}
  let action_time = new Date()

  const ActionNodeTypes = [
    'add-to-contact-list',
    'send-message',
    'send-template',
  ]
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

        console.log('Payload:', payload)
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
        postDate?: Date
      }

      payload = {
        selected_template: sendTemplateDetails.selectedTemplate,
        template_payload: sendTemplateDetails.templatePayload,
        contact_id: contact.contact_id,
        workflow_id: action.workflow_id,
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

  if (newWorkflowLogError) {
    logError(
      newWorkflowLogError as unknown as Error,
      'Error creating new workflow log'
    )
    console.log('Error creating new workflow log:', newWorkflowLogError)
    return
  }

  console.log('New workflow log created:', newWorkflowLog)
  return newWorkflowLog
}

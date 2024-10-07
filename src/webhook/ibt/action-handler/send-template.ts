import { sendMessageWithTemplate } from '../../../api/whatsapp'
import {
  Contact,
  fetchContact,
  updateContactLastContactedByUsingWaID,
} from '../../../db/contacts'
import {
  Conversation,
  fetchConversation,
  updateConversationLastMessageId,
} from '../../../db/conversations'
import { insertTemplateMessage } from '../../../db/messages'
import { fetchTemplate, Template } from '../../../db/templates'
import { updateWorkflowLog } from '../../../db/workflowLogs'
import { logError } from '../../../utils/errorLogger'
import {
  generateMessageContent,
  processTemplatePayload,
} from '../../../utils/templateUtils'
import { withRetry } from '../../../utils/withRetry'
import { formatPhoneNumber } from '../helper/formatPhoneNumber'
import { getWorkflowPhoneNumber } from '../helper/getCampaignPhoneNumber'

export const sendTemplate = async (payload: any, workflowLogId: string) => {
  const { workflow_id, contact_id, template_payload, selected_template, personalizedImageId, imageType } =
    payload

  const contact: Contact = await withRetry(
    () => fetchContact(contact_id),
    'sendTemplate > fetchContact'
  )
  
  const { selectedPhoneNumber, accessToken, phone_number_id } = await withRetry(
    () => getWorkflowPhoneNumber(workflow_id, contact, contact.project_id),
    'sendTemplate > getWorkflowPhoneNumber'
  )

  contact.wa_id = formatPhoneNumber(contact.wa_id)

  
  if (contact.wa_id === 'Invalid') {
    console.error('Invalid phone number:', contact.wa_id)
    await updateWorkflowLog(workflowLogId, {
      status: 'FAILED',
      error: 'Invalid phone number',
    })
    return
  }

  const { processedPayload, mediaUrl } = await processTemplatePayload(
    template_payload,
    contact,
    imageType,
    personalizedImageId
  )

  try {
    const { data: messageResponse } = await sendMessageWithTemplate(
      processedPayload,
      selectedPhoneNumber,
      accessToken
    )

    const template: Template = await withRetry(
      () => fetchTemplate(selected_template.template_id),
      'processCampaignLog > fetchTemplate'
    )

    const textContent = generateMessageContent(template, processedPayload)

    // Look Up conversation_id
    const conversation: Conversation = await withRetry(
      () =>
        fetchConversation(
          contact.contact_id,
          phone_number_id,
          contact.project_id
        ),
      'sendTemplate > fetchConversation'
    )

    const newMessage = await withRetry(
      () =>
        insertTemplateMessage({
          messageResponse,
          workflowId: workflow_id,
          phoneNumberId: phone_number_id,
          textContent,
          conversationId: conversation.id,
          projectId: contact.project_id,
          mediaUrl,
          contactId: contact.contact_id,
        }),
      'processCampaignLog > insertTemplateMessage'
    )

    console.log('Message created successfully:', newMessage.message_id)

    await withRetry(
      () =>
        updateConversationLastMessageId(conversation.id, newMessage.message_id),
      'processCampaignLog > updateConversationLastMessageId'
  )

    await withRetry(
      () =>
        updateContactLastContactedByUsingWaID(contact.wa_id, phone_number_id),
      'processCampaignLog > updateContactLastContactedBy'
    )

    await withRetry(
      () => updateWorkflowLog(workflowLogId, { status: 'COMPLETED' }),
      'sendTemplate > updateWorkflowLog'
    )
  } catch (error) {
    console.error('Error sending message:', error)
    logError(error as Error, 'Error sending message')
    await updateWorkflowLog(workflowLogId, {
      status: 'FAILED',
      error: error as unknown as string,
    })
  }
}

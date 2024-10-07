import { MessagePayload } from '../../../api/whatsapp'
import { logError } from '../../../utils/errorLogger'
import { sendMessage as sendMessageWhatsApp } from '../../../api/whatsapp'
import {
  Contact,
  fetchContact,
  updateContactLastContactedByUsingWaID,
} from '../../../db/contacts'
import { withRetry } from '../../../utils/withRetry'
import { getWorkflowPhoneNumber } from '../helper/getCampaignPhoneNumber'
import { formatPhoneNumber } from '../helper/formatPhoneNumber'
import { updateWorkflowLog } from '../../../db/workflowLogs'
import {
  Conversation,
  fetchConversation,
  updateConversationLastMessageId,
} from '../../../db/conversations'
import { insertMessage, Message } from '../../../db/messages'

export const sendMessage = async (payload: any, workflowLogId: string) => {
  const { message, contact_id, workflow_id, postTime, timePostType, postDate } =
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

  let messagePayload: MessagePayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: contact.wa_id,
    type: 'text',
    text: {
      body: message,
    },
  }

  // Check message for spintax and replace with random value and %name% with actual name
  const spintaxRegex = /{[^{}]*}/g
  const matches = message.match(spintaxRegex)
  if (matches) {
    matches.forEach((spintax: string) => {
      const spintaxOptions = spintax.slice(1, -1).split('|')
      const randomOption =
        spintaxOptions[Math.floor(Math.random() * spintaxOptions.length)]
      messagePayload.text.body = messagePayload.text.body.replace(
        spintax,
        randomOption
      )
    })
  }

  messagePayload.text.body = messagePayload.text.body.replace(
    /%name%/g,
    contact.name
  )

  try {
    const { data: messageResponse } = await sendMessageWhatsApp(
      messagePayload,
      selectedPhoneNumber,
      accessToken
    )

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

    const newMessage: Message = await withRetry(
      () =>
        insertMessage({
          wa_message_id: messageResponse.messages[0].id || '',
          message_type: 'text',
          contact_id,
          direction: 'outgoing',
          status: messageResponse.messages[0].message_status || 'failed',
          content: messagePayload.text.body,
          phone_number_id: phone_number_id,
          workflow_id,
          conversation_id: conversation?.id,
          project_id: contact.project_id,
        }),
      'sendMessage > insertMessage'
    )

    console.log('Message created successfully:', newMessage.message_id)

    await withRetry(
      () =>
        updateConversationLastMessageId(conversation.id, newMessage.message_id),
      'sendMessage > updateConversationLastMessageId'
    )

    await withRetry(
      () =>
        updateContactLastContactedByUsingWaID(contact.wa_id, phone_number_id),
      'sendMessage > updateContactLastContactedBy'
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

// cronJobs/processWorkflowLogs.ts
import supabase from '../../db/supabaseClient'
import { logError } from '../../utils/errorLogger'
import { Database } from '../../database.types'
import { Request, Response } from 'express'
import findOrCreateContact from '../whatsapp/helpers/findOrCreateContact'
import axios from 'axios'
import NodeCache from 'node-cache'
import { sendMessageWithTemplate } from '../../api/whatsapp'
import { updateConversation } from '../../db/conversations'

const cache = new NodeCache({ stdTTL: 3600 })

const fetchUserData = async (
  email: string,
  retries: number = 3,
  cursor: number = 0
): Promise<{ email: string; id: string; plan: string }[]> => {
  try {
    const response = await axios.get(
      `https://mylifedecode.com/api/1.1/obj/user/?key=email&constraint%20type=equals&Value=${email}&cursor=${cursor}&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${process.env.BUBBLE_API_KEY}`,
        },
      }
    )

    const userData = response.data.response.results.map((user: any) => ({
      email:
        user.authentication.email?.email || user.authentication.Facebook?.email,
      id: user._id,
      plan: user.plan || 'No plan',
      type: user.authentication.email ? 'email' : 'facebook',
    }))

    // Check if the user with the specified email exists
    const userFound = userData.some((user: any) => user.email === email)

    if (userFound) {
      return userData.filter((user: any) => user.email === email)
    }

    // If user data is not empty and user is not found, try the next page
    if (userData.length === 100 && !userFound) {
      console.log('User not found, fetching next page...')
      return await fetchUserData(email, retries, cursor + 100)
    }

    // If no more data and retries are left, return an empty array
    if (userData.length === 0 && retries > 0) {
      console.log('No users found, retrying...')
      return await fetchUserData(email, retries - 1)
    }

    return []
  } catch (error) {
    console.error('Error fetching user data: ', (error as any).data)
    if (retries > 0) {
      console.log('Retrying fetch...')
      return await fetchUserData(email, retries - 1, cursor)
    }
    throw error
  }
}

export const handlePemniVipWebhook = async (req: Request, res: Response) => {
  try {
    res.status(200).send('OK')

    const customData = req.body.customData || req.body

    // Remove the + from the phone number
    customData.phone = customData.phone.replace('+', '')

    // Function to correct Singaporean numbers mistakenly prefixed with "60"
    const correctPhoneNumber = (phone: string): string => {
      // Remove leading '0' if present
      if (phone.startsWith('0')) {
        phone = phone.substring(1)
      }
      // Check if the number starts with "60"
      if (phone.startsWith('60')) {
        const numberAfterCountryCode = phone.substring(2)
        // Check if it's a valid Singaporean number (8 digits long)
        if (/^\d{8}$/.test(numberAfterCountryCode)) {
          // Convert to Singapore number by replacing "60" with "65"
          phone = `65${numberAfterCountryCode}`
        } else if (/^[13-8]/.test(numberAfterCountryCode)) {
          // Otherwise, assume it's a valid Malaysian number (no change needed)
          phone = `60${numberAfterCountryCode}`
        } else {
          // If it doesn't match any criteria, mark as invalid
          phone = 'Invalid'
        }
      } else if (phone.startsWith('65')) {
        // Ensure it's a valid Singaporean number (must be 8 digits)
        const numberAfterCountryCode = phone.substring(2)
        if (!/^\d{8}$/.test(numberAfterCountryCode)) {
          phone = 'Invalid'
        }
      } else {
        // If it doesn't start with "60" or "65", mark as invalid
        phone = 'Invalid'
      }
      return phone
    }

    // Correct the phone number
    customData.phone = correctPhoneNumber(customData.phone)

    // Find or create contact
    let contact: { wa_id: string; profile: { name: string; email: string } } = {
      wa_id: customData.phone,
      profile: { name: customData.name, email: customData.email },
    }

    let contactId: string = ''

    await findOrCreateContact(contact, '2').then((result) => {
      contactId = result
    })

    // Check cache for user data
    let userData: { email: string; id: string; plan: string }[] =
      cache.get(customData.email) || []

    if (userData.length === 0) {
      // Fetch user data with retries
      userData = await fetchUserData(customData.email)

      // Cache the data
      cache.set(customData.phone, userData)
    }

    // Find or Create Bubble Account and Update Plan
    const user = userData.find((u: any) => u.email === contact.profile.email)

    if (user) {
      // if use already has VIP, do nothing
      if (user.plan === 'VIP' || user.plan === 'VIP + Tier 4') {
        console.log(`User ${user.email} already has VIP plan`)
        return
      }

      // Check if the user's plan is tier 4, if so, update to 'VIP + Tier 4', else update to 'VIP'
      if (user.plan === 'Tier 4' || user.plan === 'Tier 3') {
        customData.plan = 'VIP + Tier 4'
      } else {
        customData.plan = 'VIP'
      }

      // Update the plan if user exists
      await axios.patch(
        `https://mylifedecode.com/api/1.1/obj/user/${user.id}`,
        { plan: customData.plan },
        {
          headers: {
            Authorization: `Bearer ${process.env.BUBBLE_API_KEY}`,
          },
        }
      )
      console.log(`Updated user ${user.email} with new plan ${customData.plan}`)
      // Send
      const { data: messageResponse } = await sendMessageWithTemplate(
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: customData.phone,
          type: 'template',
          template: {
            name: 'existing_user_vip_onboard_v2',
            language: {
              code: 'zh_CN',
            },
            components: [
              {
                type: 'body',
                parameters: [
                  {
                    type: 'text',
                    text: customData.name,
                  },
                  {
                    type: 'text',
                    text: contact.profile.email,
                  },
                  {
                    type: 'text',
                    text: 'https://bit.ly/vip-tutorial',
                  },
                  {
                    type: 'text',
                    text: 'https://pemnitan.com/vip-zoom',
                  },
                ],
              },
            ],
          },
        },
        '220858504440106',
        process.env.PEMNI_WHATSAPP_API_TOKEN || ''
      )
      if (messageResponse.data.messages[0]) {
        var conversationId = ''
        // Look Up Conversation ID
        const { data: conversationData, error: conversationError } =
          await supabase
            .from('conversations')
            .select('id')
            .eq('phone_number_id', '5')
            .eq('contact_id', contactId)
            .single()

        if (conversationError) {
          // Create a new conversation if not found
          const { data: newConversationData, error: newConversationError } =
            await supabase
              .from('conversations')
              .insert([
                {
                  phone_number_id: '5',
                  contact_id: contactId,
                  project_id: '2',
                },
              ])
              .select('*')
              .single()
          if (newConversationError) {
            console.error(
              'Error creating new conversation:',
              newConversationError
            )
            logError(newConversationError, 'Error creating new conversation')
          }
          conversationId = newConversationData.id
        } else {
          conversationId = conversationData.id
        }

        const { data: newMessage, error: messageError } = await supabase
          .from('messages')
          .insert([
            {
              wa_message_id: messageResponse.messages[0].id || '',
              phone_number_id: '5',
              contact_id: contactId,
              message_type: 'TEMPLATE',
              content: `亲爱的${customData.name}，\n.\n🎉 恭喜你成功加人生GPS - VIP 福利包！🎉\n.\n你的会员新账号已经创建好啦，赶紧按照下面步骤来开始吧：\n.\n*【如果你是第一次登入】*\n*(1) 打开会员网站: https://mylifedecode.com/*\n*(2) 用以下信息通过电子邮件登录：*\n   *- 电子邮件:* ${contact.profile.email}\n   *\n\n*(3) 登录后点击 <VIP福利包> 就可以观看啦！*\n.\n*【如果你已经是网站会员】*\n*(1) 打开会员网站 https://mylifedecode.com/*\n*(2) 用facebook登入*\n*(3) 登录后点击 <VIP福利包> 就可以观看啦！*\n.\n🎈还不是很清楚怎么登入？\n点击观看，会一步一步教你：\n>> https://bit.ly/vip-tutorial\n.\n*Here's your Zoom Link to enter VIP Room:*\n👉 https://pemnitan.com/vip-zoom\n.\n.\n如果有任何问题或需要帮助，随时联系我们哟。祝你学习愉快！😊\n.\n>> Support: 6011-5878 5417\n>> Serene: 6011-20560692\n.\nMaster Pemni 团队`,
              direction: 'outgoing',
              status: messageResponse.messages[0].message_status || 'failed',
              project_id: '2',
              conversation_id: conversationId,
            },
          ])
          .select('*')
          .single()

        if (messageError) {
          console.error('Error inserting message:', messageError)
          logError(messageError, 'Error inserting message')
        }

        // Update to conversation to have the latest message
        await updateConversation(conversationId, newMessage.message_id)

        // Update to the table pemni_vip_logs
        await supabase.from('pemni_vip_logs').insert([
          {
            contact_id: contactId,
            password: 'N/A',
            status: 'SUCCESS',
          },
        ])
      } else {
        // Update to the table pemni_vip_logs
        await supabase.from('pemni_vip_logs').insert([
          {
            contact_id: contactId,
            password: 'N/A',
            status: 'FAILED',
          },
        ])
      }
    } else {
      const randomPassword = Math.random().toString(36).slice(-8) // Generate random password

      // Create new user account if not found
      const newUser = await axios.post(
        'https://mylifedecode.com/api/1.1/obj/user',
        {
          email: contact.profile.email,
          name: contact.profile.name,
          password: randomPassword,
          plan: 'VIP',
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.BUBBLE_API_KEY}`,
          },
        }
      )
      console.log(`Created new user ${newUser.data.email} with plan VIP`)

      // Send
      const { data: messageResponse } = await sendMessageWithTemplate(
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: customData.phone,
          type: 'template',
          template: {
            name: 'new_user_vip_onboard_v2',
            language: {
              code: 'zh_CN',
            },
            components: [
              {
                type: 'body',
                parameters: [
                  {
                    type: 'text',
                    text: customData.name,
                  },
                  {
                    type: 'text',
                    text: contact.profile.email,
                  },
                  {
                    type: 'text',
                    text: randomPassword,
                  },
                  {
                    type: 'text',
                    text: 'https://bit.ly/vip-tutorial',
                  },
                  {
                    type: 'text',
                    text: 'https://pemnitan.com/vip-zoom',
                  },
                ],
              },
            ],
          },
        },
        '220858504440106',
        process.env.PEMNI_WHATSAPP_API_TOKEN || ''
      )

      if (messageResponse.messages[0]) {
        var conversationId = ''
        // Look Up Conversation ID
        const { data: conversationData, error: conversationError } =
          await supabase
            .from('conversations')
            .select('id')
            .eq('phone_number_id', '5')
            .eq('contact_id', contactId)
            .single()

        if (conversationError) {
          // Create a new conversation if not found
          const { data: newConversationData, error: newConversationError } =
            await supabase
              .from('conversations')
              .insert([
                {
                  phone_number_id: '5',
                  contact_id: contactId,
                  project_id: '2',
                },
              ])
              .select('*')
              .single()
          if (newConversationError) {
            console.error(
              'Error creating new conversation:',
              newConversationError
            )
            logError(newConversationError, 'Error creating new conversation')
          }
          conversationId = newConversationData.id
        } else {
          conversationId = conversationData.id
        }
        // Insert the message into the messages table

        const { data: newMessage, error: messageError } = await supabase
          .from('messages')
          .insert([
            {
              wa_message_id: messageResponse.messages[0].id || '',
              phone_number_id: '5',
              contact_id: contactId,
              message_type: 'TEMPLATE',
              content: `亲爱的${customData.name}，\n.\n🎉 恭喜你成功加人生GPS - VIP 福利包！🎉\n.\n你的会员新账号已经创建好啦，赶紧按照下面步骤来开始吧：\n.\n*【如果你是第一次登入】*\n*(1) 打开会员网站: https://mylifedecode.com/*\n*(2) 用以下信息通过电子邮件登录：*\n   *- 电子邮件:* ${contact.profile.email}\n   *- 密码:* ${randomPassword}\n\n*(3) 登录后点击 <VIP福利包> 就可以观看啦！*\n.\n*【如果你已经是网站会员】*\n*(1) 打开会员网站 https://mylifedecode.com/*\n*(2) 用facebook登入*\n*(3) 登录后点击 <VIP福利包> 就可以观看啦！*\n.\n🎈还不是很清楚怎么登入？\n点击观看，会一步一步教你：\n>> https://bit.ly/vip-tutorial\n.\n*Here's your Zoom Link to enter VIP Room:*\n👉 https://pemnitan.com/vip-zoom\n.\n.\n如果有任何问题或需要帮助，随时联系我们哟。祝你学习愉快！😊\n.\n>> Support: 6011-5878 5417\n>> Serene: 6011-20560692\n.\nMaster Pemni 团队`,
              direction: 'outgoing',
              status: messageResponse.messages[0].message_status || 'failed',
              project_id: '2',
              conversation_id: conversationId,
            },
          ])
          .select('*')
          .single()

        if (messageError) {
          console.error('Error inserting message:', messageError)
          logError(messageError, 'Error inserting message')
        }

        // Update to conversation to have the latest message
        await updateConversation(conversationId, newMessage.message_id)

        // Update to the table pemni_vip_logs
        await supabase.from('pemni_vip_logs').insert([
          {
            contact_id: contactId,
            password: randomPassword,
            status: 'SUCCESS',
          },
        ])
      } else {
        // Update to the table pemni_vip_logs
        await supabase.from('pemni_vip_logs').insert([
          {
            contact_id: contactId,
            password: randomPassword,
            status: 'FAILED',
          },
        ])
      }
    }
  } catch (error) {
    console.error('Error processing webhook:', (error as any).data)
    logError(error, 'Error processing webhook')
    res.status(500).json({ error: 'Internal server error' })
  }
}

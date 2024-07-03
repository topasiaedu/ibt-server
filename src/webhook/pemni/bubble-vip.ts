// cronJobs/processWorkflowLogs.ts
import supabase from '../../db/supabaseClient'
import { logError } from '../../utils/errorLogger'
import { Database } from '../../database.types'
import { Request, Response } from 'express'
import findOrCreateContact from '../whatsapp/helpers/findOrCreateContact'
import axios from 'axios'
import NodeCache from 'node-cache'
import { sendMessageWithTemplate } from '../../api/whatsapp'

const cache = new NodeCache({ stdTTL: 3600 }) // Cache items expire after 1 hour

const fetchUserData = async (
  phone: string,
  retries: number = 3
): Promise<{ email: string; id: string; plan: string }[]> => {
  try {
    const response = await axios.get(
      'https://mylifedecode.com/version-test/api/1.1/obj/user',
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

    if (userData.length === 0 && retries > 0) {
      console.log('No users found, retrying...')
      return await fetchUserData(phone, retries - 1)
    }

    return userData
  } catch (error) {
    console.error('Error fetching user data: ', error)
    if (retries > 0) {
      console.log('Retrying fetch...')
      return await fetchUserData(phone, retries - 1)
    }
    throw error
  }
}

export const handlePemniVipWebhook = async (req: Request, res: Response) => {
  try {
    res.status(200).send('OK')
    console.log('Pemni VIP Webhook received', req.body)

    // Remove the + from the phone number
    req.body.phone = req.body.phone.replace('+', '')

    // Find or create contact
    let contact: { wa_id: string; profile: { name: string; email: string } } = {
      wa_id: req.body.phone,
      profile: { name: req.body.name, email: req.body.email },
    }

    let contactId: string = ''

    await findOrCreateContact(contact, '2').then((result) => {
      contactId = result
    })

    // Check cache for user data
    let userData: { email: string; id: string; plan: string }[] =
      cache.get(req.body.phone) || []

    if (userData.length === 0) {
      // Fetch user data with retries
      userData = await fetchUserData(req.body.phone)

      // Cache the data
      cache.set(req.body.phone, userData)
    } else {
      console.log('Cache hit: ', userData)
    }

    // Now userData contains the cached data or fresh data from the API
    console.log('User Data: ', userData)

    // Find or Create Bubble Account and Update Plan
    const user = userData.find((u: any) => u.email === contact.profile.email)

    console.log('User: ', user)

    if (user) {
      // if use already has VIP, do nothing
      if (user.plan === 'VIP' || user.plan === 'VIP + Tier 4') {
        console.log(`User ${user.email} already has VIP plan`)
        return
      }

      // Check if the user's plan is tier 4, if so, update to 'VIP + Tier 4', else update to 'VIP'
      if (user.plan === 'Tier 4') {
        req.body.plan = 'VIP + Tier 4'
      } else {
        req.body.plan = 'VIP'
      }

      // Update the plan if user exists
      await axios.patch(
        `https://mylifedecode.com/version-test/api/1.1/obj/user/${user.id}`,
        { plan: req.body.plan },
        {
          headers: {
            Authorization: `Bearer ${process.env.BUBBLE_API_KEY}`,
          },
        }
      )
      console.log(`Updated user ${user.email} with new plan ${req.body.plan}`)
      // Send
      const whatsappResponse = await sendMessageWithTemplate(
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: req.body.phone,
          type: 'template',
          template: {
            name: 'existing_vip_onboard',
            language: {
              code: 'zh_CN',
            },
            "components": [
              {
                "type": "body",
                "parameters": [
                  {
                    "type": "text",
                    "text": req.body.name 
                  },
                  {
                    "type": "text",
                    "text": contact.profile.email
                  },
                  {
                    "type": "text",
                    "text": "https://www.veed.io/view/dac5718d-2680-4f4d-a585-60b860f86b0d?panel=share"
                  }
                ]
              }
            ]
          },
        },
        '450006871520050',
        process.env.PEMNI_WHATSAPP_API_TOKEN || ''
      )

      console.log('Whatsapp response:', whatsappResponse.data)
    } else {
      const randomPassword = Math.random().toString(36).slice(-8) // Generate random password

      // Create new user account if not found
      const newUser = await axios.post(
        'https://mylifedecode.com/version-test/api/1.1/obj/user',
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
      const whatsappResponse = await sendMessageWithTemplate(
        {
          "messaging_product": "whatsapp",
          "recipient_type": "individual",
          "to": req.body.phone,
          "type": "template",
          "template": {
            "name": "new_vip_onboard",
            "language": {
              "code": "zh_CN"
            },
            "components": [
              {
                "type": "body",
                "parameters": [
                  {
                    "type": "text",
                    "text": req.body.name 
                  },
                  {
                    "type": "text",
                    "text": contact.profile.email
                  },
                  {
                    "type": "text",
                    "text": randomPassword
                  },
                  {
                    "type": "text",
                    "text": "https://www.veed.io/view/dac5718d-2680-4f4d-a585-60b860f86b0d?panel=share"
                  }
                ]
              }
            ]
          }
        }
        ,
        '450006871520050',
        process.env.PEMNI_WHATSAPP_API_TOKEN || ''
      )

      console.log('Whatsapp response:', whatsappResponse.data)
    }
  } catch (error) {
    console.error('Error processing webhook:', error)
    logError(error, 'Error processing webhook')
    res.status(500).json({ error: 'Internal server error' })
  }
}

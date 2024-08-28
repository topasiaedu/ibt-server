import { Request, Response } from 'express'
import { withRetry } from '../../utils/withRetry'
import { Contact, findOrCreateContact } from '../../db/contacts'
import { createContactEvent } from '../../db/contactEvents'

export const handleContactEvent = async (req: Request, res: Response) => {
  res.status(200).send('OK')

  const { name, email, phone, type, description, projectId } = req.body

  const contact: Contact = await withRetry(
    () => findOrCreateContact(phone, name, projectId, email),
    'handleContactEvent > findOrCreateContact'
  )

await withRetry(
    () =>
      createContactEvent({
        contact_id: contact.contact_id,
        type,
        description,
      }),
    'handleContactEvent > createContactEvent'
  )
}

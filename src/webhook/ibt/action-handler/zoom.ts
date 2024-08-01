import { logError } from '../../../utils/errorLogger'
import { Zoom, fetchZoomByProjectId, updateZoom } from '../../../db/zoom'
import { withRetry } from '../../../utils/withRetry'
import { updateWorkflowLog } from '../../../db/workflowLogs'

export const zoom = async (payload: any, workflowId: string) => {
  const { project_id, email, first_name, last_name, meeting_id } = payload

  // Fetch Zoom
  const zoom: Zoom = await withRetry(() => fetchZoomByProjectId(project_id))

  if (!zoom.gen_token) {
    zoom.gen_token = Buffer.from(
      `${zoom.client_id}:${zoom.client_secret}`
    ).toString('base64')

    // Update Zoom
    await withRetry(() => updateZoom(zoom.id, { gen_token: zoom.gen_token }))
  }

  // Get Access Token
  let accessToken: string

  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${zoom.account_id}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${zoom.gen_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )

  if (response.ok) {
    const json = await response.json()
    accessToken = json.access_token

    const addContactResponse = await fetch(
      `https://api.zoom.us/v2/meetings/${meeting_id}/registrants`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          first_name,
          last_name,
        }),
      }
    )

    if (!addContactResponse.ok) {
      logError(
        new Error('Error adding contact to Zoom'),
        'Error adding contact to Zoom'
      )
    }

    // Update workflow log status to completed
    await withRetry(() =>
      updateWorkflowLog(workflowId, { status: 'COMPLETED' })
    )
  }
}

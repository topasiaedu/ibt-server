import axios from 'axios'
import cors from 'cors'
import dotenv from 'dotenv'
import express, { Express, Request, Response } from 'express'
import { Server, createServer } from 'http'
import localtunnel from 'localtunnel'
import { errorHandler } from './middleware/errorHandler'
import { loggerMiddleware } from './middleware/logger'
import { logError } from './utils/errorLogger'
import {
  reschedulePendingCampaigns,
  setupRealtimeCampaignProcessing,
} from './webhook/ibt/processCampaigns'
import { handleIBTWebhook } from './webhook/ibt/processIBTWebhook'
import {
  reschedulePendingWorkflowLogs,
  setupRealtimeWorkflowLogProcessing,
} from './webhook/ibt/processWorkflow'
import { handlePemniVipWebhook } from './webhook/pemni/bubble-vip'
import { handleWebhook } from './webhook/whatsapp/webhookHandler'
dotenv.config()

const app: Express = express()
const port: number = parseInt(process.env.PORT as string, 10) || 8080
const uniqueSubdomain = 'ibtnm' + 'ndcqrsyx6t4n7um'
const environment = process.env.NODE_ENV || 'development'
let tunnelURl: string = 'https://ibtnmndcqrsyx6t4n7um.loca.lt'

// Middleware
app.use(cors()) // Enable CORS for all requests
app.use(express.json()) // Parse JSON bodies
app.use(loggerMiddleware) // Use the logger middleware for all requests

// Routes setup
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Whatsgenie 2.0 Backend API' })
})

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === 'AIErZ0xweiBhCHPvPM0oMAQ9zD89KjYg') {
    // Use VERIFY_TOKEN from your .env file
    res.status(200).send(challenge)
    console.log('Webhook verified successfully!')
  } else {
    res.sendStatus(403)
  }
})

app.post('/webhook', (req, res) => {
  handleWebhook(req, res)

  if (environment !== 'development') {
    // Proxy the request to tunnel ( we send the same exact request to the tunnel which is our local server for development )
    axios
      .post(tunnelURl + '/webhook', req.body)
      .then((response) => {
        console.log('Webhook forwarded to tunnel')
      })
      .catch((error) => {
        // console.error('Error forwarding webhook to tunnel')
      })
  }
})

app.post('/ibt/webhook/:id', handleIBTWebhook)

app.post('/update-tunnel-url', (req, res) => {
  tunnelURl = req.body.tunnelURl
  res.json({ message: 'Tunnel URL updated' })
})

// The error handler must be the last piece of middleware added to the app
app.use(errorHandler)

// Pemni VIP webhook
app.post('/pemni/vip', handlePemniVipWebhook)


let server: Server

const startServer = () => {
  server = createServer(app)

  server.listen(port, () => {
    console.log(`Server running on port ${port}`)

    // Local tunnel
    if (environment === 'development') {
      const tunnel = localtunnel(
        port,
        { subdomain: uniqueSubdomain },
        (err, tunnel) => {
          if (err) {
            console.error(err)
            logError(`Local tunnel error: ${err}`)
            process.exit(1)
          }

          console.log(`Local tunnel running on ${tunnel?.url}`)

          // Send post request to live server (ibts.whatsgenie.com) to update the tunnel URL
          axios
            .post('https://ibts3.whatsgenie.com/update-tunnel-url', {
              tunnelURl: tunnel?.url,
            })
            .then((response) => {
              console.log('Tunnel URL updated on live server')
            })
            .catch((error) => {
              console.error('Error updating tunnel URL on live server')
              logError(
                `Error updating tunnel URL on live server: ${error.message}`
              )
            })
        }
      )

      tunnel?.on('close', () => {
        console.log('Local tunnel closed')
        logError('Local tunnel closed')
        process.exit(1)
      })
    }

    // Setup realtime processing
    const unsubscribeRealtimeCampaignProcessing =
      setupRealtimeCampaignProcessing()
    const unsubscribeRealtimeWorkflowLogProcessing =
      setupRealtimeWorkflowLogProcessing()

    // Reschedule pending tasks
    reschedulePendingCampaigns()
    reschedulePendingWorkflowLogs()

    // Gracefully handle server shutdown
    function shutdown() {
      unsubscribeRealtimeCampaignProcessing()
      unsubscribeRealtimeWorkflowLogProcessing()
      process.exit(0)
    }

    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      const errorMessage = `Port ${port} is already in use. Trying to restart...`
      console.error(errorMessage)
      logError(errorMessage)
      setTimeout(() => {
        server.close(() => {
          const retryMessage = 'Retrying to start the server...'
          console.log(retryMessage)
          logError(retryMessage)
          startServer()
        })
      }, 1000) // Wait 1 second before retrying
    } else {
      const errorMessage = `Server error: ${err}`
      console.error(errorMessage)
      logError(errorMessage)
      process.exit(1)
    }
  })
}

startServer()
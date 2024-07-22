import express from "express"
import serverless from "serverless-http"
import webpush from "web-push"
import bodyParser from "body-parser"
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node'; // Correct import path for JSONFile

// Setup lowdb with JSON file
const adapter = new JSONFile("data/db.json")
const defaultData = { subscriptions: [] }
const db = new Low(adapter, defaultData)

const vapidDetails = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT,
}

// Initialize the database with default data if missing
async function initDB() {
  await db.read()
  if (!db.data) {
    db.data = { subscriptions: [] }
    await db.write()
  }
}

await initDB() // Ensure DB is initialized before any route handler

function sendNotifications(subscriptions) {
  const notification = JSON.stringify({
    title: "Hello, Notifications!",
    options: {
      body: `ID: ${Math.floor(Math.random() * 100)}`,
    },
  })

  const options = {
    TTL: 10000,
    vapidDetails: vapidDetails,
  }

  subscriptions.forEach((subscription) => {
    const endpoint = subscription.endpoint
    const id = endpoint.substr(endpoint.length - 8, endpoint.length)
    webpush
      .sendNotification(subscription, notification, options)
      .then((result) => {
        console.log(`Endpoint ID: ${id}`)
        console.log(`Result: ${result.statusCode}`)
      })
      .catch((error) => {
        console.log(`Endpoint ID: ${id}`)
        console.log(`Error: ${error}`)
      })
  })
}

const app = express()
app.use(bodyParser.json())
app.use(express.static("public"))

app.post("/add-subscription", async (request, response) => {
  console.log("/add-subscription")
  console.log(request.body)
  console.log(`Subscribing ${request.body.endpoint}`)
  await db.read() // Ensure the latest data is read
  db.data.subscriptions.push(request.body)
  await db.write()
  response.sendStatus(200)
})

app.post("/remove-subscription", async (request, response) => {
  console.log("/remove-subscription")
  console.log(request.body)
  console.log(`Unsubscribing ${request.body.endpoint}`)
  await db.read() // Ensure the latest data is read
  db.data.subscriptions = db.data.subscriptions.filter(
    (sub) => sub.endpoint !== request.body.endpoint
  )
  await db.write()
  response.sendStatus(200)
})

app.post("/notify-me", async (request, response) => {
  console.log("/notify-me")
  console.log(request.body)
  console.log(`Notifying ${request.body.endpoint}`)
  await db.read() // Ensure the latest data is read
  const subscription = db.data.subscriptions.find(
    (sub) => sub.endpoint === request.body.endpoint
  )
  if (subscription) {
    sendNotifications([subscription])
    response.sendStatus(200)
  } else {
    response.sendStatus(404)
  }
})

app.post("/notify-all", async (request, response) => {
  console.log("/notify-all")
  await db.read() // Ensure the latest data is read
  const subscriptions = db.data.subscriptions
  if (subscriptions.length > 0) {
    sendNotifications(subscriptions)
    response.sendStatus(200)
  } else {
    response.sendStatus(409)
  }
})

const router = express.Router()
router.use("/", app)

export const handler = serverless(router)

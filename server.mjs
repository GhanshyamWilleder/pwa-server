import "dotenv/config" // Load environment variables from .env file
import express from "express"
import webpush from "web-push"
import bodyParser from "body-parser"
import { Low } from "lowdb"
import { JSONFile } from "lowdb/node" // Correct import path for JSONFil
import cors from "cors"

// Setup lowdb with JSON file
const adapter = new JSONFile(".data/db.json")
const defaultData = { subscriptions: [] }
const db = new Low(adapter, defaultData)

const vapidDetails = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT,
}

// Initialize the database
async function initDB() {
  await db.read();
  db.data ||= { subscriptions: [] }; // Ensure the default structure is set
  await db.write();
}

initDB();

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
app.use(cors())
app.use(bodyParser.json())
app.use(express.static("public"))

app.post("/add-subscription", async (request, response) => {
  console.log(`Subscribing ${request.body.endpoint}`)
  await db.read() // Ensure the latest data is read
  db.data.subscriptions.push(request.body)
  await db.write()
  response.sendStatus(200)
})

app.post("/remove-subscription", async (request, response) => {
  console.log(`Unsubscribing ${request.body.endpoint}`)
  await db.read() // Ensure the latest data is read
  db.data.subscriptions = db.data.subscriptions.filter(
    (sub) => sub.endpoint !== request.body.endpoint
  )
  await db.write()
  response.sendStatus(200)
})

app.post("/notify-me", async (request, response) => {
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
  await db.read() // Ensure the latest data is read
  const subscriptions = db.data.subscriptions
  if (subscriptions.length > 0) {
    sendNotifications(subscriptions)
    response.sendStatus(200)
  } else {
    response.sendStatus(409)
  }
})

const listener = app.listen(8080, () => {
  console.log(`Listening on port ${listener.address().port}`)
})

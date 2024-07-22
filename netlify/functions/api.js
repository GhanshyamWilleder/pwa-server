require("dotenv").config() // Load environment variables from .env file
const express = require("express")
const serverless = require("serverless-http")
const webpush = require("web-push")
const bodyParser = require("body-parser")
const cors = require("cors")

async function setupDB() {
  const { Low } = await import("lowdb")
  const { JSONFile } = await import("lowdb/node")

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

  async function sendNotifications(subscriptions) {
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

    for (const subscription of subscriptions) {
      const endpoint = subscription.endpoint
      const id = endpoint.substr(endpoint.length - 8, endpoint.length)
      try {
        const result = await webpush.sendNotification(
          subscription,
          notification,
          options
        )
        console.log(`Endpoint ID: ${id}`)
        console.log(`Result: ${result.statusCode}`)
      } catch (error) {
        console.log(`Endpoint ID: ${id}`)
        console.log(`Error: ${error}`)
      }
    }
  }

  const app = express()
  app.use(cors())
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
      await sendNotifications([subscription])
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
      await sendNotifications(subscriptions)
      response.sendStatus(200)
    } else {
      response.sendStatus(409)
    }
  })

  app.get("/fetch-example", async (request, response) => {
    const fetch = (await import("node-fetch")).default
    try {
      const res = await fetch("https://api.example.com/data")
      const data = await res.json()
      response.json(data)
    } catch (error) {
      response.status(500).json({ error: "Failed to fetch data" })
    }
  })

  const router = express.Router()
  router.use("/", app)

  return { handler: serverless(router), app }
}

if (process.env.NODE_ENV !== "production") {
  setupDB().then(({ app }) => {
    const PORT = 8080
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`)
    })
  })
}

module.exports.handler = (event, context) =>
  setupDB().then(({ handler }) => handler(event, context))

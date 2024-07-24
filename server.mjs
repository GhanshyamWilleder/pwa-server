import "dotenv/config"
import express from "express"
import serverless from "serverless-http"
import webpush from "web-push"
import bodyParser from "body-parser"
import cors from "cors"
import wordlist from "./data/wordlist.json" assert { type: "json" }
// import { Low } from "lowdb"
// import { JSONFile } from "lowdb/node"

const app = express()
app.use(cors()) // Enable CORS for all routes
app.use(bodyParser.json())
app.use(express.static("public"))

let timerId
let subscriptionsDB = []

const vapidDetails = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT,
}

// const adapter = new JSONFile("data/db.json")
// const defaultData = { subscriptions: [] }
// const db = new Low(adapter, defaultData)

// async function initDB() {
//   await db.read()
//   if (!db.data) {
//     db.data = { subscriptions: [] }
//     await db.write()
//   }
//   console.log("DB initialized with subscriptions:", db.data.subscriptions)
// }

function sendNotifications(subscriptions) {
  console.log("sendNotifications called with subscriptions:", subscriptions)

  // Clear any existing interval
  if (timerId) {
    clearInterval(timerId)
  }

  timerId = setInterval(async () => {
    console.log("setInterval triggered")

    const randomWord =
      wordlist.words[Math.floor(Math.random() * wordlist.words.length)]
    const notification = JSON.stringify({
      title: randomWord.word,
      options: {
        body: randomWord.definition,
      },
    })

    for (const subscription of subscriptions) {
      const endpoint = subscription.endpoint
      const id = endpoint.substr(endpoint.length - 8, endpoint.length)
      const options = {
        vapidDetails,
        TTL: 60,
      }

      try {
        const result = await webpush.sendNotification(
          subscription,
          notification,
          options
        )
        console.log(`Notification sent to ${id}`, result)
      } catch (error) {
        console.error(`Failed to send notification to ${id}:`, error)
      }
    }
    console.log("Sent notifications to all subscribers 🚀")
  }, 6000)

  console.log("setInterval has been set")
}

app.post("/add-subscription", async (request, response) => {
  // await db.read()
  // db.data.subscriptions.push(request.body)
  // await db.write()
  subscriptionsDB.push(request.body)
  sendNotifications(
    subscriptionsDB.length > 0 ? subscriptionsDB : [request.body]
  )
  response.sendStatus(200)
})

app.post("/remove-subscription", async (request, response) => {
  // await db.read()
  // db.data.subscriptions = db.data.subscriptions.filter(
  //   (sub) => sub.endpoint !== request.body.endpoint
  // )
  // await db.write()
  subscriptionsDB = subscriptionsDB.filter(
    (sub) => sub.endpoint !== request.body.endpoint
  )

  sendNotifications(subscriptionsDB ? subscriptionsDB : [])
  response.sendStatus(200)
})

app.post("/notify-me", async (request, response) => {
  // await db.read()
  // const subscription = db.data.subscriptions.find(
  //   (sub) => sub.endpoint === request.body.endpoint
  // )
  const subscription = subscriptionsDB.find(
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
  // await db.read()
  // const subscriptions = db.data.subscriptions
  const subscriptions = subscriptionsDB
  if (subscriptions.length > 0) {
    sendNotifications(subscriptions)
    response.sendStatus(200)
  } else {
    response.sendStatus(409)
  }
})

const port = process.env.PORT || 8080

// initDB().then(() => {
//   app.listen(port, () => {
//     console.log(`Server is running on port ${port}`)
//   })
// })

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})

// const router = express.Router()
// router.use("/", app)

// export const handler = serverless(router)

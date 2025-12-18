require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const admin = require("firebase-admin");
const port = process.env.PORT || 3000;
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf-8"
);
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://b12-m11-session.web.app",
    ],
    credentials: true,
    optionSuccessStatus: 200,
  })
);
app.use(express.json());

// jwt middlewares
const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(" ")[1];
  console.log(token);
  if (!token) return res.status(401).send({ message: "Unauthorized Access!" });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    console.log(decoded);
    next();
  } catch (err) {
    console.log(err);
    return res.status(401).send({ message: "Unauthorized Access!", err });
  }
};

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const db = client.db("blood-donationDB");
    const usersCollection = db.collection("users");
    const donationRequestCollection = db.collection
    ("donationRequests");
    const fundsCollection = db.collection("funds");

    //signUp data ---> db
    app.post("/users", async (req, res) => {
      const user = req.body;
      const isExist = await usersCollection.findOne({ email: user.email });
      if (isExist) {
        return res.send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    // get all users data from db
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    
    // create donation request
    app.post("/donation-requests", async (req, res) => {
      const request = req.body;
      request.status = "pending";
      request.createdAt = new Date();

      const result = await donationRequestCollection.insertOne(request);
      res.send({ success: true, insertedId: result.insertedId });
    });
    // get donation requests (admin / filter)
    app.get("/donation-requests", async (req, res) => {
      const { email, status, limit } = req.query;

      let query = {};
      if (email) query.requesterEmail = email;
      if (status) query.status = status;

      let cursor = donationRequestCollection
        .find(query)
        .sort({ createdAt: -1 });

      if (limit) {
        cursor = cursor.limit(parseInt(limit));
      }

      const result = await cursor.toArray();
      res.send(result);
    });

    const { ObjectId } = require("mongodb");
    // donation details
    app.get("/donation-requests/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await donationRequestCollection.findOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to get donation request" });
      }
    });
    // update user profile

    // Update user profile
    app.patch("/users/:email", verifyJWT, async (req, res) => {
      const { email } = req.params;
      const updateData = { ...req.body };

      delete updateData.email;

      if (Object.keys(updateData).length === 0) {
        return res
          .status(400)
          .send({ success: false, message: "No data to update" });
      }

      try {
        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(404).send({ message: "User not found" });
        if (req.tokenEmail !== email)
          return res.status(403).send({ message: "Forbidden" });

        const result = await usersCollection.updateOne(
          { email },
          { $set: updateData }
        );

        res.send({
          success: true,
          message: "Profile updated successfully",
          result,
        });
      } catch (err) {
        console.error(err);
        res
          .status(500)
          .send({ success: false, message: "Failed to update profile" });
      }
    });
   // donation & progress











    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Server..");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

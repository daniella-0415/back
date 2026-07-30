const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const axios = require("axios");
const bcrypt = require("bcrypt");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const client = new MongoClient(process.env.MONGO_URI);

let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db(process.env.DB_NAME);
        console.log("MongoDB Connected");
    } catch (error) {
        console.error(error);
    }
}

connectDB();

async function basicAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Basic ")) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const base64Token = authHeader.split(" ")[1];
        if (!base64Token) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const credentialsDecoded = Buffer.from(base64Token, "base64").toString("ascii");
        
        const [email, password] = credentialsDecoded.split(":");
        if (!email || !password) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const user = await db.collection("users").findOne({ email: email });
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("Auth Error:", error);
        return res.status(401).json({ error: "Unauthorized" });
    }
}

app.post("/signup", async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({
                error: "Missing required fields"
            });
        }

        const existingUser = await db.collection("users").findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            firstName,
            lastName,
            email,
            password: hashedPassword 
        };

        const result = await db.collection("users").insertOne(newUser);

        console.log("User Registered Successfully");
        res.status(201).json({
            message: "User registered successfully",
            insertedId: result.insertedId
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server Error" });
    }
});



app.post("/signin", async (req, res) => {
    try {

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        const user = await db.collection("users").findOne({ email });

        if (!user) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        res.status(200).json({
            message: "Login successful",
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Server Error"
        });

    }
});

app.get("/users", basicAuth, async (req, res) => {
    try {
        const users = await db.collection("users").find().project({ password: 0 }).toArray();
        res.status(200).json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server Error" });
    }
});

app.get("/users/:id", basicAuth, async (req, res) => {
    try {
        const user = await db.collection("users").findOne(
            { _id: new ObjectId(req.params.id) },
            { projection: { password: 0 } }
        );

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.status(200).json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server Error" });
    }
});

app.put("/users/:id", basicAuth, async (req, res) => {
    try {
        const updateData = { ...req.body };
        if (updateData.password) {
            updateData.password = await bcrypt.hash(updateData.password, 10);
        }

        const result = await db.collection("users").updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.status(200).json({ message: "User updated" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server Error" });
    }
});

app.delete("/users/:id", basicAuth, async (req, res) => {
    try {
        const result = await db.collection("users").deleteOne({
            _id: new ObjectId(req.params.id)
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.status(200).json({ message: "User deleted" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server Error" });
    }
});

app.get("/cars", basicAuth, async (req, res) => {
    try {
        const cars = await db.collection("cars").find().toArray();
        res.status(200).json(cars);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server Error" });
    }
});

app.get("/cars/:id", basicAuth, async (req, res) => {
    try {
        const car = await db.collection("cars").findOne({ _id: new ObjectId(req.params.id) });
        if (!car) {
            return res.status(404).json({ error: "Car not found" });
        }
        res.status(200).json(car);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server Error" });
    }
});

app.post("/cars", basicAuth, async (req, res) => {
    try {
        const { name, category, pricePerHour, available } = req.body;
        if (!name || !category || pricePerHour == null) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        if (pricePerHour < 0) {
            return res.status(400).json({ error: "Price cannot be negative" });
        }

        const result = await db.collection("cars").insertOne({ name, category, pricePerHour, available });
        res.status(201).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server Error" });
    }
});


app.post("/bookings", basicAuth, async (req, res) => {
    try {
        const { carId, startDate, endDate } = req.body;
        if (!carId || !startDate || !endDate) {
            return res.status(400).json({ error: "Missing booking parameters" });
        }

       
        const car = await db.collection("cars").findOne({ _id: new ObjectId(carId) });
        if (!car) return res.status(404).json({ error: "Car not found" });
        if (!car.available) return res.status(400).json({ error: "Car is currently unavailable" });

        const newBooking = {
            userId: req.user._id, 
            carId: new ObjectId(carId),
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            status: "pending",
            createdAt: new Date()
        };

        const result = await db.collection("bookings").insertOne(newBooking);
        res.status(201).json({ message: "Booking created successfully", bookingId: result.insertedId });
    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
});

app.get("/bookings/my-bookings", basicAuth, async (req, res) => {
    try {
        const userBookings = await db.collection("bookings").find({ userId: req.user._id }).toArray();
        res.status(200).json(userBookings);
    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
});

app.post("/payments", basicAuth, async (req, res) => {
    try {
        const { bookingId, amount, paymentMethod } = req.body;
        if (!bookingId || !amount || !paymentMethod) {
            return res.status(400).json({ error: "Missing payment fields" });
        }

        const booking = await db.collection("bookings").findOne({ _id: new ObjectId(bookingId), userId: req.user._id });
        if (!booking) return res.status(404).json({ error: "Booking not found or access denied" });

        const newPayment = {
            bookingId: new ObjectId(bookingId),
            userId: req.user._id,
            amount: parseFloat(amount),
            paymentMethod,
            status: "completed", 
            transactionDate: new Date()
        };

        const result = await db.collection("payments").insertOne(newPayment);
        
        await db.collection("bookings").updateOne(
            { _id: new ObjectId(bookingId) },
            { $set: { status: "confirmed" } }
        );

        res.status(201).json({ message: "Payment processed successfully", paymentId: result.insertedId });
    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
});


app.post("/locations", basicAuth, async (req, res) => {
    try {
        const { branchName, address, city, coordinates } = req.body;
        if (!branchName || !address || !city) {
            return res.status(400).json({ error: "Missing location parameters" });
        }

        const newLocation = { branchName, address, city, coordinates: coordinates || null };
        const result = await db.collection("locations").insertOne(newLocation);
        res.status(201).json({ message: "Location added successfully", locationId: result.insertedId });
    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
});

app.get("/locations", basicAuth, async (req, res) => {
    try {
        const locations = await db.collection("locations").find().toArray();
        res.status(200).json(locations);
    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
});


app.post("/reviews", basicAuth, async (req, res) => {
    try {
        const { carId, rating, comment } = req.body;
        if (!carId || !rating) return res.status(400).json({ error: "Car ID and rating are required" });
        if (rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be between 1 and 5" });

        const newReview = {
            carId: new ObjectId(carId),
            userId: req.user._id,
            userName: `${req.user.firstName} ${req.user.lastName}`,
            rating: parseInt(rating),
            comment: comment || "",
            createdAt: new Date()
        };

        const result = await db.collection("reviews").insertOne(newReview);
        res.status(201).json({ message: "Review posted successfully", reviewId: result.insertedId });
    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
});

app.get("/reviews/car/:carId", basicAuth, async (req, res) => {
    try {
        const reviews = await db.collection("reviews").find({ carId: new ObjectId(req.params.carId) }).toArray();
        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
});




app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

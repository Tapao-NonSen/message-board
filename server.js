// Required Modules
const express = require("express");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
require("dotenv").config();

// Create Express App
const app = express();
const PORT = 3000;
const badWords = ["หี", "ควย", "แม่ง", "เหี้ย", "สัส", "ไอ้เหี้ย", "ไอ้สัตว์", "มึง", "กู", "อีดอก", "อีควาย", "ไอ้เวร", "เชี่ย", "แรด", "กาก", "กระหรี่", "หน้าหี", "หน้าควย", "ชิบหาย", "พ่อง", "แม่มึง", "พ่อมึง", "เย็ด", "เย็ดแม่", "ล่อ", "ล่อแม่", "ตอแหล", "อีตอแหล", "เสือก", "หน้าส้นตีน", "จังไร", "ฟาย", "ขยะ", "หมอย", "แตด", "ดาก", "ปลวก", "ไอ้ชาติหมา", "ชาติชั่ว", "เงี่ยน", "หำ", "หางแดง", "เจ็ก", "ยาจก", "อีสัส", "เอี้ย", "นรก", "ปัญญาอ่อน", "ห่าราก", "กะหรี่", "ลาว", "เวรตะไล", "ปากหมา", "โง่", "ดอกทอง", "บัดซบ", "ส้นตีน", "ไอ้ฟาย", "อีโง่", "ชาติหมา", "ถุย", "ไอ้ดอก", "สลิ่ม", "fuck", "shit", "bitch", "bastard", "dick", "cunt", "asshole", "damn", "crap", "fag", "whore", "piss", "slut", "suck", "moron", "jerk", "stupid", "idiot", "retard", "wanker", "bollocks", "prick", "tosser", "twat", "freak", "goddamn", "hell", "screw", "dumbass", "skank", "pussy", "hoe", "nutjob", "pervert", "loser", "douche", "shithead", "arsehole", "bimbo", "bollix", "arse", "twit", "weirdo", "bimbo", "dillweed", "freaking", "bloody", "plonker", "wuss", "dweeb", "fudgepacker", "crapper", "knobhead", "pissant", "noob", "killjoy", "snob", "bore", "maggot", "sleazebag", "tool", "numbnuts", "sicko", "arsewipe", "clown", "simp", "harpy", "cow", "dipshit"];

// Environment Variables
const DATA_FILE = "./public/data/messages.json";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const INDEX_PASSWORD = process.env.INDEX_PASSWORD;
const CF_TURNSTILE_SECRET_KEY = process.env.CF_TURNSTILE_SECRET_KEY;

// Middleware
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  dest: './uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 2 MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only .png, .jpg, .jpeg formats are allowed!'));
    }
  },
});

// Serve Home Page with Password Check
app.get("/", (req, res, next) => {
  const password = req.query.password;
  if (!password || password !== INDEX_PASSWORD) {
    return res.redirect("https://kkuspace.com");
  }
  next();
});

app.use(express.static("public", { extensions: ["html", "htm"] }));

app.get("/", (req, res) => {
  const indexPath = path.resolve(__dirname, "public", "index.html");
  res.sendFile(indexPath);
});

// Submit Route with CAPTCHA Validation and File Upload
app.post("/data/submit", upload.single('image'), async (req, res) => {
  try {
    const { "cf-turnstile-response": token, author, ID } = req.body;
    let messages = req.body.messages ? JSON.parse(req.body.messages) : [];

    // Validate CAPTCHA Token
    if (!token) {
      return res.status(400).json({ error: "ยืนยันตัวตนล้มเหลว" });
    }

    const verifyResponse = await axios.post(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      new URLSearchParams({
        secret: CF_TURNSTILE_SECRET_KEY,
        response: token,
      })
    );

    const { success } = verifyResponse.data;

    if (!success) {
      return res.status(400).json({ error: "ยืนยันตัวตนล้มเหลว" });
    }

    // Process uploaded image
    if (req.file) {
      if (!author || !ID) {
        return res.status(400).json({ error: "Invalid" });
      }

      const normalizedAuthor = author ? author.replace(/\s+/g, '').toLowerCase() : '';

      // Check if the normalized author contains any bad words
      if (badWords.some(word => normalizedAuthor.includes(word))) {
        return res.status(400).json({ error: "มีคำไม่เหมาะสมในข้อความหรือชื่อผู้ส่ง" });
      }

      messages.push({
        type: "image",
        content: `/uploads/${req.file.filename}`, // Path to the uploaded image
        author,
        ID,
      });
    }

    // Process text messages
    if (messages.length > 0) {
      for (const msg of messages) {
        if (!msg.author || !msg.ID || !msg.content) {
          return res.status(400).json({ error: "Invalid" });
        }
      }
    }

    // Check if messages is an array or a string and handle both cases
    const messagesToCheck = Array.isArray(messages) ? messages : [messages];

    // Normalize and check for bad words in both content and author fields
    if (messagesToCheck.some(msg => {
      // Normalize content and author by removing spaces
      const normalizedContent = msg.content ? msg.content.replace(/\s+/g, '').toLowerCase() : '';
      const normalizedAuthor = msg.author ? msg.author.replace(/\s+/g, '').toLowerCase() : '';

      // Check if bad words are present in either content or author fields
      return badWords.some(word => normalizedContent.includes(word) || normalizedAuthor.includes(word));
    })) {
      return res.status(400).json({ error: "มีคำไม่เหมาะสมในข้อความหรือชื่อผู้ส่ง" });
    }


    // Read existing data file
    fs.readFile(DATA_FILE, (err, data) => {
      if (err) {
        console.error("Error reading data file:", err);
        return res.status(500).json({ error: "ไฟล์ไม่สามารถอ่านได้ กรุณาติดต่อเจ้าหน้าที่" });
      }

      let fileData;
      try {
        fileData = JSON.parse(data);
      } catch (parseError) {
        console.error("Error parsing JSON:", parseError);
        return res.status(500).json({ error: "ไฟล์เสียหาย กรุณาติดต่อเจ้าหน้าที่" });
      }

      // Append new messages to existing data
      fileData.messages = fileData.messages.concat(messages);

      // Write updated data back to file
      fs.writeFile(DATA_FILE, JSON.stringify(fileData, null, 2), (err) => {
        if (err) {
          console.error("Error saving data:", err);
          return res.status(500).json({ error: "ไม่สามารถเซฟไฟล์ได้ กรุณาติดต่อเจ้าหน้าที่" });
        }

        res.status(200).json({ message: "Messages saved successfully." });
      });
    });
  } catch (error) {
    console.error("Error processing submission:", error);

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "ไฟล์ใหญ่เกินไป" });
    }

    res.status(500).json({ error: "เซิฟเวอร์มีปัญหา" });
  }
});

// Serve Uploaded Files
app.use('/uploads', express.static('uploads'));

// Admin Authentication
app.post("/admin/authenticate", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.status(200).json({ message: "Authentication successful" });
  } else {
    res.status(401).json({ message: "Incorrect password" });
  }
});

// Route: Get Current Data
app.get("/admin/data", (req, res) => {
  fs.readFile(DATA_FILE, (err, data) => {
    if (err) return res.status(500).json({ message: "Error reading data file" });
    res.status(200).json(JSON.parse(data));
  });
});

// Route: Update Data
app.post("/admin/data", (req, res) => {
  const { messages, interval } = req.body;

  if (!messages || typeof interval !== "number") {
    return res.status(400).json({ message: "Invalid data submitted" });
  }

  const updatedData = { messages, interval };
  fs.writeFile(DATA_FILE, JSON.stringify(updatedData, null, 2), (err) => {
    if (err) return res.status(500).json({ message: "Error saving data" });
    res.status(200).json({ message: "Data updated successfully" });
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    sheetId: process.env.GOOGLE_SHEET_ID,
    apiKey: process.env.GOOGLE_API_KEY,
  });
});

// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
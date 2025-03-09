const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const axios = require("axios");
const fs = require("fs");
const cors = require("cors");

const app = express();
const upload = multer({ dest: "uploads/" });

const API_KEY = "AIzaSyDrm8mSn_6Xe8jcMLD7TfQkNV7608hIanw"; // Replace with your API Key

app.use(cors());

// Function to get subscriber count
async function getSubscriberCount(channelId) {
    try {
        const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${API_KEY}`;
        const response = await axios.get(url);
        return response.data.items[0]?.statistics.subscriberCount || "Unknown";
    } catch (error) {
        console.error(`Error fetching subscribers for ${channelId}:`, error.message);
        return "Unknown";
    }
}

// Function to extract channel ID from YouTube URL
function extractChannelId(url) {
    if (url.includes("/channel/")) {
        return url.split("/channel/")[1];
    } else {
        return null;
    }
}

// Endpoint to handle CSV upload and process data
app.post("/upload-csv", upload.single("csv"), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const results = [["YouTube URL", "Subscriber Count"]];

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", async (row) => {
            const youtubeUrl = Object.values(row)[0]; // Extract YouTube URL
            const channelId = extractChannelId(youtubeUrl);

            if (channelId) {
                const subscribers = await getSubscriberCount(channelId);
                results.push([youtubeUrl, subscribers]);
            } else {
                results.push([youtubeUrl, "Invalid URL"]);
            }
        })
        .on("end", () => {
            fs.unlinkSync(req.file.path); // Delete file after processing
            res.json({ success: true, data: results });
        });
});

app.listen(5000, () => console.log("Server running on port 5000"));

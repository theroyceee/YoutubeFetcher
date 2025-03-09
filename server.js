const express = require("express");
const multer = require("multer");
const csvParser = require("csv-parser");
const fs = require("fs");
const axios = require("axios");
const cors = require("cors");

const app = express();
const upload = multer({ dest: "uploads/" });

const API_KEY = "AIzaSyDrm8mSn_6Xe8jcMLD7TfQkNV7608hIanw";
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Function to get channel subscriber count
async function getSubscribers(channelId) {
    try {
        const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${API_KEY}`;
        const response = await axios.get(url);
        return response.data.items[0]?.statistics.subscriberCount || "Unknown";
    } catch (error) {
        console.error(`Error fetching subscribers for ${channelId}:`, error.message);
        return "Unknown";
    }
}

// Function to get latest video details
async function getLatestVideo(channelId) {
    try {
        const url = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=1&type=video`;
        const response = await axios.get(url);
        const video = response.data.items[0];

        if (!video) return { title: "No video found", views: "N/A" };

        const videoId = video.id.videoId;
        const title = video.snippet.title;
        const views = await getVideoViews(videoId);

        return { title, views };
    } catch (error) {
        console.error(`Error fetching video for ${channelId}:`, error.message);
        return { title: "Error", views: "Error" };
    }
}

// Function to get video views
async function getVideoViews(videoId) {
    try {
        const url = `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${videoId}&part=statistics`;
        const response = await axios.get(url);
        return response.data.items[0]?.statistics.viewCount || "Unknown";
    } catch (error) {
        console.error(`Error fetching views for ${videoId}:`, error.message);
        return "Unknown";
    }
}

// Upload CSV and process
app.post("/upload-csv", upload.single("csv"), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const results = [["YouTube URL", "Subscribers", "Latest Video Title", "Views"]];
    const filePath = req.file.path;

    fs.createReadStream(filePath)
        .pipe(csvParser())
        .on("data", async (row) => {
            const url = Object.values(row)[0];
            const channelId = url.split("/").pop();

            const subscribers = await getSubscribers(channelId);
            const latestVideo = await getLatestVideo(channelId);

            results.push([url, subscribers, latestVideo.title, latestVideo.views]);
        })
        .on("end", () => {
            fs.unlinkSync(filePath); // Delete file after processing
            res.json({ success: true, data: results });
        })
        .on("error", (err) => res.status(500).json({ success: false, message: err.message }));
});

// Serve updated CSV file
app.get("/download-csv", (req, res) => {
    const csvContent = results.map((row) => row.join(",")).join("\n");
    fs.writeFileSync("updated_channels.csv", csvContent);
    res.download("updated_channels.csv");
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

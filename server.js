const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const csv = require("csv-parser");
const axios = require("axios");

const app = express();
const upload = multer({ dest: "uploads/" });

const API_KEY = "AIzaSyDrm8mSn_6Xe8jcMLD7TfQkNV7608hIanw"; // Replace with a valid YouTube API key

app.use(cors());
app.use(express.json());

async function getChannelId(url) {
    const regex = /(?:channel\/|user\/|c\/|@)([a-zA-Z0-9_-]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

async function getChannelStats(channelId) {
    try {
        const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${API_KEY}`;
        const response = await axios.get(url);
        return response.data.items[0]?.statistics.subscriberCount || "Unknown";
    } catch (error) {
        console.error(`Error fetching subscribers for ${channelId}:`, error.message);
        return "Unknown";
    }
}

async function getLatestVideo(channelId) {
    try {
        const url = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=1&type=video`;
        const response = await axios.get(url);
        if (response.data.items.length > 0) {
            const video = response.data.items[0];
            return { videoId: video.id.videoId, title: video.snippet.title };
        }
    } catch (error) {
        console.error(`Error fetching video for ${channelId}:`, error.message);
    }
    return { videoId: null, title: "No Video Found" };
}

async function getVideoViews(videoId) {
    if (!videoId) return "N/A";
    try {
        const url = `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${videoId}&part=statistics`;
        const response = await axios.get(url);
        return response.data.items[0]?.statistics.viewCount || "Unknown";
    } catch (error) {
        console.error(`Error fetching views for ${videoId}:`, error.message);
        return "Unknown";
    }
}

app.post("/upload-csv", upload.single("csv"), async (req, res) => {
    const results = [["YouTube URL", "Subscribers", "Latest Video Title", "Views"]];
    const channels = [];

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (row) => {
            channels.push(Object.values(row)[0]);
        })
        .on("end", async () => {
            for (const url of channels) {
                const channelId = await getChannelId(url);
                if (!channelId) {
                    results.push([url, "Invalid URL", "N/A", "N/A"]);
                    continue;
                }

                const subscribers = await getChannelStats(channelId);
                const videoData = await getLatestVideo(channelId);
                const views = await getVideoViews(videoData.videoId);

                results.push([url, subscribers, videoData.title, views]);
            }

            fs.writeFileSync("updated_channels.csv", results.map(row => row.join(",")).join("\n"));
            res.json({ success: true, data: results });
        });
});

app.get("/download-csv", (req, res) => {
    res.download("updated_channels.csv");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

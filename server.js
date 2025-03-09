
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const csv = require("csv-parser");
const axios = require("axios");

const app = express();
const upload = multer({ dest: "uploads/" });
const PORT = 5000;
const API_KEY = "AIzaSyDrm8mSn_6Xe8jcMLD7TfQkNV7608hIanw";
const OUTPUT_CSV = "updated_channels.csv";

app.use(cors());
app.use(express.json());

// ✅ Read CSV File
function readCSV(filename) {
    return new Promise((resolve, reject) => {
        const channels = [];
        fs.createReadStream(filename)
            .pipe(csv())
            .on("data", row => {
                console.log("CSV Row:", row); // Debugging log
                channels.push(Object.values(row)[0]); // Assuming 1st column has URLs
            })
            .on("end", () => {
                console.log("Final Channel List:", channels); // Debugging log
                resolve(channels);
            })
            .on("error", error => reject(error));
    });
}

// ✅ Fetch Latest Video Details
async function getLatestVideo(channelId, duration) {
    try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=1&type=video&videoDuration=${duration}`;
        const response = await axios.get(searchUrl);

        if (response.data.items.length > 0) {
            const video = response.data.items[0];
            return { videoId: video.id.videoId, title: video.snippet.title };
        }
    } catch (error) {
        console.error(`Error fetching ${duration} video for ${channelId}:`, error.message);
    }
    return null;
}

// ✅ Get Video Views
async function getVideoViews(videoId) {
    try {
        const statsUrl = `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${videoId}&part=statistics`;
        const response = await axios.get(statsUrl);
        return response.data.items[0]?.statistics.viewCount || "Unknown";
    } catch (error) {
        console.error(`Error fetching views for video ${videoId}:`, error.message);
        return "Unknown";
    }
}

// ✅ Process Channels
async function fetchLatestVideos(channels) {
    const results = [["YouTube URL", "Latest Video Title", "Views"]];

    for (const url of channels) {
        const channelId = url.split("/").pop(); // Extract channel ID from URL
        let videoData = await getLatestVideo(channelId, "long");

        if (!videoData) {
            console.log(`No long videos found for ${url}, searching for shorts...`);
            videoData = await getLatestVideo(channelId, "short");
        }

        if (videoData) {
            const views = await getVideoViews(videoData.videoId);
            results.push([url, videoData.title, views]);
        } else {
            results.push([url, "No video found", "N/A"]);
        }
    }

    return results;
}

// ✅ Save Data to CSV
function saveToCSV(data, filename) {
    const csvContent = data.map(row => row.join(",")).join("\n");
    fs.writeFileSync(filename, csvContent);
    console.log(`Updated data saved to ${filename}`);
}

// ✅ Upload and Process CSV
app.post("/upload-csv", upload.single("csv"), async (req, res) => {
    console.log("File uploaded:", req.file.path); // Debugging log

    try {
        const channels = await readCSV(req.file.path);
        console.log("Parsed Channels:", channels); // Debugging log

        const updatedData = await fetchLatestVideos(channels);
        saveToCSV(updatedData, OUTPUT_CSV);

        res.json({ success: true, message: "CSV processed", data: updatedData });
    } catch (error) {
        console.error("Error processing CSV:", error.message);
        res.status(500).json({ success: false, message: "Error processing CSV" });
    }
});

// ✅ Download Updated CSV
app.get("/download-csv", (req, res) => {
    res.download(OUTPUT_CSV, "updated_channels.csv");
});

// ✅ Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

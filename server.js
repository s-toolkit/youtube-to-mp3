import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();
const PORT = process.env.PORT || 10000;

/**
 * Normalize YouTube URL to standard "https://www.youtube.com/watch?v=ID"
 */
function normalizeYouTubeUrl(url) {
  try {
    const u = new URL(url);

    // youtu.be/<id>
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/watch?v=${u.pathname.slice(1)}`;
    }

    // youtube.com/embed/<id>
    if (u.pathname.startsWith("/embed/")) {
      return `https://www.youtube.com/watch?v=${u.pathname.split("/")[2]}`;
    }

    // youtube.com/watch?v=<id>
    if (u.searchParams.has("v")) {
      return `https://www.youtube.com/watch?v=${u.searchParams.get("v")}`;
    }

    return null; // not recognized
  } catch {
    return null;
  }
}

// API Endpoint
app.get("/download", async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl) return res.status(400).json({ error: "Missing url parameter" });

  const videoUrl = normalizeYouTubeUrl(rawUrl);
  if (!videoUrl) return res.status(400).json({ error: "Invalid YouTube URL" });

  try {
    const form = new FormData();
    form.append("client-type", "web");
    form.append("client-name", "Mazmazika");
    form.append("url", videoUrl);

    let response = await fetch("https://www.mazmazika.com/dl2025.php", {
      method: "POST",
      body: form
    });

    if (!response.ok) throw new Error(`Mazmazika API error: ${response.statusText}`);

    let result = await response.json();

    // Handle queue: retry every 3 seconds if queued
    while (result.filename === "queued") {
      console.log("Waiting in queue...");
      await new Promise(r => setTimeout(r, 3000));

      response = await fetch("https://www.mazmazika.com/dl2025.php", {
        method: "POST",
        body: form
      });
      result = await response.json();
    }

    if (result.filename === "error") {
      return res.status(500).json({ error: result.data });
    }

    // Decode base64 MP3
    const buffer = Buffer.from(result.data, "base64");

    // Send MP3 file
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename || "download.mp3"}"`
    );
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buffer);

  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => console.log(`✅ API server running on port ${PORT}`));
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

    // youtube.com/shorts/<id>
    if (u.pathname.startsWith("/shorts/")) {
      return `https://www.youtube.com/watch?v=${u.pathname.split("/")[2]}`;
    }

    return null; // not recognized
  } catch {
    return null;
  }
}

// Optional: simple root route
app.get("/", (req, res) => {
  res.send("✅ YouTube MP3 API running. Use /download?url=VIDEO_URL");
});

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

    if (result.filename === "queued") {
      // simple single retry after 3s
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

    // Return base64 string instead of saving file
    res.json({
      filename: result.filename || "download.mp3",
      base64: result.data
    });

  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => console.log(`✅ API server running on port ${PORT}`));

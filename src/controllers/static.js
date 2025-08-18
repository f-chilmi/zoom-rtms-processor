import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const serveZoomApp = (req, res) => {
  try {
    // Set OWASP security headers
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://appssdk.zoom.us; " +
        "style-src 'self' 'unsafe-inline'; " +
        "connect-src 'self' https: wss:; " +
        "img-src 'self' data: https:; " +
        "frame-src 'self'; " +
        "worker-src 'self' blob:"
    );

    // Additional security headers
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");

    // Read and serve the HTML file
    const htmlPath = path.join(__dirname, "../public/zoom-app.html");

    if (!fs.existsSync(htmlPath)) {
      return res.status(404).send("Zoom app HTML file not found");
    }

    const html = fs.readFileSync(htmlPath, "utf8");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  } catch (error) {
    console.error("Error serving Zoom app:", error);
    res.status(500).send("Internal server error");
  }
};

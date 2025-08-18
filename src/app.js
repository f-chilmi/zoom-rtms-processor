import express from "express";
import session from "express-session";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import routes from "./routes/index.js";

const app = express();

// Session middleware for Zoom OAuth
app.use(
  session({
    secret: process.env.ZOOM_APP_OAUTH_STATE_SECRET || "your-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/", routes);

// Error handlers
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Start server
const port = config.server.port;
app.listen(port, () => {
  logger.info(`RTMS Processor started on port ${port}`);
  logger.info(`Environment: ${config.server.nodeEnv}`);
});

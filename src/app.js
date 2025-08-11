import rtms from "@zoom/rtms";
import express from "express";
import { meetingService } from "./services/meeting.service.js";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";

const app = express();
// const meetingService = new MeetingService();
const clients = new Map();

// Middleware
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/webhook", async (req, res) => {
  try {
    const { event, payload } = req.body;
    console.log("payload post webhook -> ", payload);

    const streamId = payload?.rtms_stream_id;
    const meetingUuid = payload?.meeting_uuid;

    logger.info(`Received webhook event: ${event}`, { streamId, meetingUuid });

    if (event === "meeting.rtms_stopped") {
      await handleMeetingStopped(streamId, meetingUuid);
    } else if (event === "meeting.rtms_started") {
      await handleMeetingStarted(streamId, payload);
    } else {
      logger.debug(`Ignoring unknown event: ${event}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error(`Error handling webhook event:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// RTMS webhook handler
// rtms.onWebhookEvent(async ({ event, payload }) => {
//   console.log("payload -> ", payload);
//   //   payload ->  {
//   //   meeting_uuid: 'phhcINXTR3moHaP0UVfDAw==',
//   //   operator_id: 'Oam3T9DyQ9W2iXCLrk4Stg',
//   //   rtms_stream_id: 'b82ee47aa8f144caa8fad459bde10c0f',
//   //   server_urls: 'wss://zoomsjc144-195-19-86zssgw.sjc.zoom.us:443'
//   // }
//   const streamId = payload?.rtms_stream_id;
//   const meetingUuid = payload?.meeting_uuid;

//   logger.info(`Received webhook event: ${event}`, { streamId, meetingUuid });

//   try {
//     if (event === "meeting.rtms_stopped") {
//       await handleMeetingStopped(streamId, meetingUuid);
//     } else if (event === "meeting.rtms_started") {
//       await handleMeetingStarted(streamId, payload);
//     } else {
//       logger.debug(`Ignoring unknown event: ${event}`);
//     }
//   } catch (error) {
//     logger.error(`Error handling webhook event ${event}:`, error);
//   }
// });

async function handleMeetingStopped(streamId, meetingUuid) {
  if (!streamId) {
    logger.warn("Received meeting.rtms_stopped event without streamId");
    return;
  }

  const client = clients.get(streamId);
  if (!client) {
    logger.warn(
      `Received meeting.rtms_stopped for unknown streamId: ${streamId}`
    );
    return;
  }

  try {
    // Process meeting end (upload files, notify backend, cleanup)
    await meetingService.processMeetingEnd(streamId, meetingUuid);

    // Leave meeting and cleanup client
    await client.leave();
    clients.delete(streamId);

    logger.info(`Successfully processed meeting end: ${streamId}`);
  } catch (error) {
    logger.error(`Error in handleMeetingStopped for ${streamId}:`, error);
    // Cleanup client even on error
    try {
      await client.leave();
      clients.delete(streamId);
    } catch (leaveError) {
      logger.error(`Error leaving client for ${streamId}:`, leaveError);
    }
  }
}

async function handleMeetingStarted(streamId, payload) {
  if (!streamId) {
    logger.warn("Received meeting.rtms_started event without streamId");
    return;
  }

  try {
    // Create new RTMS client
    const client = new rtms.Client();
    clients.set(streamId, client);

    // Set up event handlers
    setupClientHandlers(client, streamId);

    // Join the meeting
    await client.join(payload);
    logger.info(`Successfully joined meeting: ${streamId}`);
  } catch (error) {
    logger.error(`Error in handleMeetingStarted for ${streamId}:`, error);
    clients.delete(streamId);
  }
}

function setupClientHandlers(client, streamId) {
  // Transcription handler

  client.onTranscriptData((data, size, timestamp, metadata) => {
    try {
      console.log(`[${timestamp}] -- ${metadata?.userName}: ${data}`);
      meetingService.addTranscription(streamId, data, timestamp, metadata);
    } catch (error) {
      logger.error(`Error in transcript callback for ${streamId}:`, error);
    }
  });

  // Audio handler
  client.onAudioData((data, size, timestamp, metadata) => {
    try {
      meetingService.saveAudioData(streamId, data);
    } catch (error) {
      logger.error(`Error in audio callback for ${streamId}:`, error);
    }
  });

  // // Video configuration (optional)
  // const videoParams = {
  //   contentType: rtms.VideoContentType.RAW_VIDEO,
  //   codec: rtms.VideoCodec.H264,
  //   resolution: rtms.VideoResolution.SD,
  //   dataOpt: rtms.VideoDataOption.VIDEO_SINGLE_ACTIVE_STREAM,
  //   fps: 30,
  // };

  // client.setVideoParams(videoParams);
  // client.onVideoData((data, size, timestamp, metadata) => {
  //   // Video processing can be added here if needed
  // });

  // client.setDeskshareParams(videoParams);
  // client.onDeskshareData((data, size, timestamp, metadata) => {
  //   // Deskshare processing can be added here if needed
  // });
}

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

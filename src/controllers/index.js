import rtms from "@zoom/rtms";
import { meetingService } from "../services/meeting.service.js";
import { logger } from "../utils/logger.js";

const ZOOM_SECRET_TOKEN = process.env.ZOOM_APP_CLIENT_SECRET;

const clients = new Map();

export const healthController = (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
};

export const webhookController = async (req, res) => {
  try {
    const { event, payload } = req.body;
    console.log("payload post webhook -> ", payload);

    const streamId = payload?.rtms_stream_id;
    const meetingUuid = payload?.meeting_uuid;

    logger.info(`Received webhook event: ${event}`, { streamId, meetingUuid });

    switch (event) {
      case "endpoint.url_validation":
        return handleUrlValidation(payload, res);
      case "meeting.rtms_stopped":
        await handleMeetingStopped(streamId, meetingUuid);
        break;
      case "meeting.rtms_started":
        await handleMeetingStarted(streamId, payload);
        break;

      default:
        logger.debug(`Ignoring unknown event: ${event}`);
        break;
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error(`Error handling webhook event:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
};

function handleUrlValidation(payload, res) {
  if (!payload?.plainToken) return res.sendStatus(400);

  const encryptedToken = crypto
    .createHmac("sha256", ZOOM_SECRET_TOKEN)
    .update(payload.plainToken)
    .digest("hex");

  console.log("Responding to Zoom URL validation challenge");
  return res.json({
    plainToken: payload.plainToken,
    encryptedToken,
  });
}

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
}

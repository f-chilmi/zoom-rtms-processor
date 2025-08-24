import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { StorageService } from "./storage.service.js";
import { ApiService } from "./api.service.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

class MeetingService {
  constructor() {
    this.transcriptions = new Map();
    this.audioWriters = new Map();
    this.meetingStartTimes = new Map();
    this.meetingContexts = new Map(); // Store meeting contexts including zoomUserId
    this.storageService = new StorageService();
    this.apiService = new ApiService();
  }

  // Store meeting context when meeting starts
  setMeetingContext(streamId, context) {
    this.meetingContexts.set(streamId, context);
    logger.debug(`Stored meeting context for ${streamId}:`, context);
  }

  addTranscription(streamId, data, timestamp, metadata) {
    try {
      // Validate inputs
      if (!streamId || !data || !timestamp || !metadata) {
        logger.debug("Invalid transcription data received, skipping");
        return;
      }

      const trimmedData = data.toString().trim();
      if (!trimmedData) {
        logger.debug("Empty transcription data, skipping");
        return;
      }

      if (!this.transcriptions.has(streamId)) {
        this.transcriptions.set(streamId, []);
      }

      // Initialize meeting start time
      if (!this.meetingStartTimes.has(streamId)) {
        this.meetingStartTimes.set(streamId, Number(timestamp));
      }

      // Calculate relative time from meeting start
      const startTime = this.meetingStartTimes.get(streamId);
      const relativeStart = (Number(timestamp) - startTime) / 1000000;

      this.transcriptions.get(streamId).push({
        userId: metadata.userId || null,
        speaker: metadata.userName || "Unknown",
        text: trimmedData,
        start: relativeStart,
        end: relativeStart + 2,
      });

      logger.debug(
        `Transcription added for ${streamId}: ${metadata.userName}: ${trimmedData}`
      );
    } catch (error) {
      logger.error(`Error adding transcription for ${streamId}:`, error);
    }
  }

  saveAudioData(streamId, audioData) {
    try {
      const fileName = `zoom_meeting_${streamId}.raw`;
      const filePath = path.join(process.cwd(), "temp", fileName);

      // Ensure temp directory exists
      const tempDir = path.dirname(filePath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      let writer = this.audioWriters.get(streamId);
      if (!writer) {
        writer = fs.createWriteStream(filePath);
        this.audioWriters.set(streamId, writer);
        logger.info(`Created audio file: ${fileName}`);
      }

      writer.write(audioData);
    } catch (error) {
      logger.error(`Error saving audio data for ${streamId}:`, error);
    }
  }

  async processMeetingEnd(streamId, meetingUuid) {
    try {
      logger.info(`Processing meeting end for stream: ${streamId}`);

      // Get meeting context (includes zoomUserId)
      const meetingContext = this.meetingContexts.get(streamId);
      if (!meetingContext || !meetingContext.zoomUserId) {
        logger.error(`No meeting context or zoomUserId found for ${streamId}`);
        throw new Error(`Missing meeting context for ${streamId}`);
      }

      // Close audio writer
      const writer = this.audioWriters.get(streamId);
      if (writer) {
        await new Promise((resolve) => {
          writer.end(resolve);
        });
        this.audioWriters.delete(streamId);
        logger.info(`Closed audio file for meeting: ${streamId}`);
      }

      // Convert to MP3
      const mp3Path = await this.convertRawToMp3(streamId);
      if (!mp3Path) {
        throw new Error(`Failed to convert audio to MP3 for ${streamId}`);
      }

      // Get transcription data
      const transcriptionData = this.transcriptions.get(streamId) || [];
      console.log(84, "transcriptionData", transcriptionData);

      // Prepare meeting summary
      const meetingSummary = this.generateMeetingSummary(
        transcriptionData,
        streamId,
        meetingUuid
      );

      // Upload files to storage
      const [audioUrl] = await Promise.all([
        this.storageService.uploadAudioFile(mp3Path, streamId),
      ]);

      // Prepare meeting data with zoomUserId
      const meetingData = {
        streamId,
        meetingUuid,
        zoomUserId: meetingContext.zoomUserId, // Include zoomUserId
        audioUrl,
        transcriptionResult: transcriptionData,
        duration: meetingSummary.duration,
        participants: meetingSummary.participants.length,
        participantsList: meetingSummary.participants,
        processedAt: new Date().toISOString(),
        operatorId: meetingContext.operatorId || null, // Include if available
      };

      // Notify backend
      await this.apiService.notifyMeetingProcessed(meetingData);

      // Cleanup
      await this.cleanup(streamId, mp3Path);

      logger.info(`Meeting processing completed successfully for: ${streamId}`);
    } catch (error) {
      logger.error(`Error processing meeting end for ${streamId}:`, error);
      // Attempt cleanup even on error
      await this.cleanup(streamId);
      throw error;
    }
  }

  async convertRawToMp3(streamId) {
    try {
      const rawFileName = `zoom_meeting_${streamId}.raw`;
      const mp3FileName = `zoom_meeting_${streamId}.mp3`;
      const rawFilePath = path.join(process.cwd(), "temp", rawFileName);
      const mp3FilePath = path.join(process.cwd(), "temp", mp3FileName);

      if (!fs.existsSync(rawFilePath)) {
        logger.error(`Raw file not found: ${rawFileName}`);
        return null;
      }

      const ffmpegCommand = `ffmpeg -f s16le -ar ${config.audio.sampleRate} -ac ${config.audio.channels} -i "${rawFilePath}" -codec:a libmp3lame -b:a ${config.audio.bitrate} "${mp3FilePath}" -y`;

      logger.info(`Converting ${rawFileName} to MP3...`);

      const { stdout, stderr } = await execAsync(ffmpegCommand);

      if (stderr) {
        logger.debug(`FFmpeg stderr: ${stderr}`);
      }

      if (fs.existsSync(mp3FilePath)) {
        logger.info(`Successfully converted to: ${mp3FileName}`);

        // Delete raw file
        fs.unlinkSync(rawFilePath);
        logger.debug(`Deleted raw file: ${rawFileName}`);

        return mp3FilePath;
      } else {
        throw new Error("MP3 file was not created");
      }
    } catch (error) {
      logger.error(`FFmpeg conversion error for ${streamId}:`, error);
      return null;
    }
  }

  generateMeetingSummary(transcriptionData, streamId, meetingUuid) {
    const participants = [...new Set(transcriptionData.map((t) => t.speaker))];
    const startTime =
      transcriptionData.length > 0 ? transcriptionData[0].start : 0;
    const endTime =
      transcriptionData.length > 0
        ? transcriptionData[transcriptionData.length - 1].end
        : 0;

    // Calculate duration in seconds
    const duration = Math.round(endTime - startTime);

    return {
      meetingId: streamId,
      meetingUuid,
      startTime: startTime
        ? new Date(Date.now() - (endTime - startTime) * 1000).toISOString()
        : null,
      endTime: new Date().toISOString(),
      duration: Math.max(duration, 0),
      participants,
      transcription: transcriptionData,
      processedAt: new Date().toISOString(),
      totalMessages: transcriptionData.length,
    };
  }

  async cleanup(streamId, mp3Path = null) {
    try {
      // Clean up memory
      this.transcriptions.delete(streamId);
      this.meetingStartTimes.delete(streamId);
      this.meetingContexts.delete(streamId); // Clean up meeting context

      // Clean up files
      const tempDir = path.join(process.cwd(), "temp");
      const rawPath = path.join(tempDir, `zoom_meeting_${streamId}.raw`);
      const defaultMp3Path = path.join(tempDir, `zoom_meeting_${streamId}.mp3`);

      const filesToDelete = [rawPath, mp3Path || defaultMp3Path].filter(
        Boolean
      );

      for (const filePath of filesToDelete) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.debug(`Deleted file: ${path.basename(filePath)}`);
        }
      }

      logger.info(`Cleanup completed for meeting: ${streamId}`);
    } catch (error) {
      logger.error(`Cleanup error for ${streamId}:`, error);
    }
  }
}

const meetingService = new MeetingService();

export { meetingService };

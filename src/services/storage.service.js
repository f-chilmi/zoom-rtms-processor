import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

class StorageService {
  constructor() {
    if (!config.supabase.url || !config.supabase.anonKey) {
      throw new Error("Supabase configuration missing");
    }

    this.supabase = createClient(config.supabase.url, config.supabase.anonKey);
    this.bucket = config.supabase.bucket;
  }

  async uploadAudioFile(filePath, streamId) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Audio file not found: ${filePath}`);
      }

      const fileBuffer = fs.readFileSync(filePath);
      const fileName = `zoom_meeting_${streamId}.mp3`;
      const storageKey = `audio/${this.sanitizeStorageKey(fileName)}`;

      logger.info(`Uploading audio file: ${storageKey}`);

      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .upload(storageKey, fileBuffer, {
          contentType: "audio/mp3",
          upsert: false,
        });

      if (error) throw error;

      const { data: publicData } = this.supabase.storage
        .from(this.bucket)
        .getPublicUrl(data.path);

      logger.info(`Audio file uploaded successfully: ${publicData.publicUrl}`);
      return publicData.publicUrl;
    } catch (error) {
      logger.error("Audio upload error:", error);
      throw error;
    }
  }

  // async uploadTranscriptionFile(transcriptionData, streamId) {
  //   try {
  //     const fileName = `transcription_${streamId}.json`;
  //     const storageKey = `transcriptions/${this.sanitizeStorageKey(fileName)}`;
  //     const jsonBuffer = Buffer.from(
  //       JSON.stringify(transcriptionData, null, 2)
  //     );

  //     logger.info(`Uploading transcription file: ${storageKey}`);

  //     const { data, error } = await this.supabase.storage
  //       .from(this.bucket)
  //       .upload(storageKey, jsonBuffer, {
  //         contentType: "application/json",
  //         upsert: false,
  //       });

  //     if (error) throw error;

  //     const { data: publicData } = this.supabase.storage
  //       .from(this.bucket)
  //       .getPublicUrl(data.path);

  //     logger.info(
  //       `Transcription file uploaded successfully: ${publicData.publicUrl}`
  //     );
  //     return publicData.publicUrl;
  //   } catch (error) {
  //     logger.error("Transcription upload error:", error);
  //     throw error;
  //   }
  // }

  sanitizeStorageKey(key) {
    return key
      .replace(/[^\w\-_.]/g, "-")
      .replace(/--+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 100);
  }
}

export { StorageService };

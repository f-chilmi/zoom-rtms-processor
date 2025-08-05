import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

class ApiService {
  constructor() {
    this.baseUrl = config.backend.apiUrl;
    this.apiKey = config.backend.apiKey;
  }

  async notifyMeetingProcessed(meetingData) {
    try {
      logger.info(
        `Notifying backend about processed meeting: ${meetingData.streamId}`
      );
      console.log(15, "meetingData", meetingData, JSON.stringify(meetingData));

      const response = await fetch(`${this.baseUrl}/zoom-meetings/processed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(meetingData),
      });

      if (!response.ok) {
        throw new Error(
          `Backend API error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      logger.info(`Backend notified successfully:`, result);
      return result;
    } catch (error) {
      logger.error("Backend API error:", error);
      throw error;
    }
  }
}

export { ApiService };

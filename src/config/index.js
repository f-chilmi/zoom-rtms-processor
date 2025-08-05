import dotenv from "dotenv";

dotenv.config();

export const config = {
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    bucket: process.env.SUPABASE_BUCKET || "transcriptions",
  },
  backend: {
    apiUrl: process.env.BACKEND_API_URL,
    apiKey: process.env.BACKEND_API_KEY,
  },
  server: {
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || "development",
  },
  audio: {
    sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE) || 16000,
    channels: parseInt(process.env.AUDIO_CHANNELS) || 1,
    bitrate: process.env.AUDIO_BITRATE || "128k",
  },
};

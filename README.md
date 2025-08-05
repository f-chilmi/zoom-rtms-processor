# Zoom RTMS Processor

Production-ready Zoom RTMS service that processes meeting audio and transcriptions.

## Features

- Real-time transcription processing
- Audio recording and MP3 conversion
- Cloud storage upload (Supabase)
- Backend API integration
- Comprehensive logging
- Error handling and cleanup

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment file:

```bash
cp .env.example .env
```

3. Configure your environment variables in `.env`

4. Start the service:

```bash
npm run dev  # Development
npm start    # Production
```

## Environment Variables

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_BUCKET`: Storage bucket name (default: transcriptions)
- `BACKEND_API_URL`: Your NestJS backend API URL
- `BACKEND_API_KEY`: API key for backend authentication
- `PORT`: Service port (default: 3001)

## API Endpoints

- `GET /health`: Health check endpoint

## File Structure

- `src/app.js`: Main application file
- `src/config/`: Configuration management
- `src/services/`: Business logic services
- `src/utils/`: Utility functions
- `temp/`: Temporary files (auto-created)
- `logs/`: Application logs (auto-created)

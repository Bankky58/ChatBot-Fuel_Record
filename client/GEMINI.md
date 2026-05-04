# Fuel Bot - Fuel Record Chatbot

A mobile-friendly, serverless web application that uses Gemini AI to record and track fuel refueling costs and volume.

## Project Overview

- **Purpose:** Provide a conversational interface (chatbot) for users to easily log fuel expenses and monitor monthly spending.
- **AI Integration:** Uses **Gemini 1.5 Flash Lite** (`gemini-1.5-flash-lite-preview`) to parse natural language inputs into structured fuel records (cost, volume, date).
- **Architecture:** Serverless React frontend communicating directly with Firebase.
- **Main Technologies:**
    - **Frontend:** React 19 (TypeScript), Vite.
    - **Database:** Firebase Firestore (NoSQL).
    - **Authentication:** Firebase Auth with Google Sign-In.
    - **Hosting:** Firebase Hosting.
    - **Styling:** Vanilla CSS (Mobile-first, optimized for PWA).
    - **Icons:** Lucide React.

## Key Features

- **AI-Powered Recording:** Just type "Spent $50" or "Filled 20L for $40 yesterday" and the bot extracts the data.
- **Chat Commands:** 
    - `/help`: Shows available commands.
    - `/clear`: Wipes chat message history (records remain safe).
    - `/history` or `/summary`: Opens the spending history modal.
- **Interactive History Modal:** 
    - Swipeable monthly carousel to view past spending.
    - Automatic monthly total calculation.
    - Ability to **Edit** or **Delete** individual records.
- **PWA Ready:** Configured for "Add to Home Screen" to provide a native app-like experience.
- **Session Context:** The bot remembers the current refueling event to allow adding details (like liters) in subsequent messages.

## Project Structure

- `client/`: Main project root.
    - `src/App.tsx`: Central hub for chat logic, AI interaction, and history UI.
    - `src/App.css`: Styles for the chat interface and interactive modal.
    - `src/firebase.ts`: Firebase SDK initialization and configuration.
    - `firebase.json`: Firebase Hosting and deployment rules.
    - `public/manifest.webmanifest`: PWA metadata.
    - `.env`: Environment variables for Firebase and Gemini API keys.

## Building and Running

Commands should be executed within the `client/` directory:

- **Install Dependencies:** `npm install`
- **Development Mode:** `npm run dev`
- **Production Build:** `npm run build`
- **Linting:** `npm run lint`
- **Deployment:** `firebase deploy`

## Development Conventions

- **Environment Variables:** Ensure `VITE_FIREBASE_*` and `VITE_GEMINI_API_KEY` are defined in `.env`.
- **Firestore Paths:** 
    - Messages: `users/{userId}/messages`
    - Fuel Records: `users/{userId}/fuel_records`
- **AI Prompting:** System instructions for Gemini are defined in `src/App.tsx`. Be careful when modifying them as they control the JSON output structure required by the app.
- **Mobile-First:** All UI changes should be tested on mobile screen sizes. Use swipe gestures for navigating the history carousel.

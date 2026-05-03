# Fuel Record Chatbot

A mobile-friendly, serverless web application that acts as a chatbot for recording fuel costs and tracking monthly spending.

## Project Overview

- **Purpose:** Provide a simple, fast interface (chatbot-style) for users to record fuel refueling costs and volume (liters) from their phones.
- **Architecture:** Serverless React application communicating directly with Firebase services (Firestore, Auth, Hosting).
- **Main Technologies:**
    - **Frontend:** React (TypeScript), Vite.
    - **Database:** Firebase Firestore.
    - **Authentication:** Firebase Auth (Google Sign-In) with session persistence.
    - **Hosting:** Firebase Hosting.
    - **Styling:** Vanilla CSS (Mobile-first, PWA optimized).
    - **Icons:** Lucide React.

## Key Features

- **Conversational Recording:** Two-step logic where the bot records the cost first and then asks for the volume in liters.
- **Chat Commands:** 
    - `/help`: Shows available commands.
    - `/clear`: Wipes chat message history (records remain safe).
    - `/history` or `/summary`: Opens the spending history modal.
- **Interactive Spending History:** 
    - Swipeable monthly carousel (swipe left/right or use arrows).
    - Monthly total calculation.
    - Detailed record list for each month (Date, Time, Volume, Cost).
- **Data Management:** Ability to **Edit** or **Delete** individual refueling records directly from the history view.
- **PWA Support:** Configured for "Add to Home Screen" with standalone mode (no browser bars) and native app feel.
- **Timestamps:** Visible timestamps on all chat messages.

## Project Structure

- `client/`: Main project directory.
    - `src/App.tsx`: Main application logic, command handling, and modal UI.
    - `src/App.css`: Styles for the chat UI, mobile responsiveness, and interactive modal.
    - `src/firebase.ts`: Firebase initialization and SDK exports.
    - `firebase.json` & `.firebaserc`: Firebase configuration.
    - `public/manifest.webmanifest`: PWA configuration for native app behavior.
    - `.env`: Environment variables for Firebase credentials.

## Building and Running

All commands should be run from the `client/` directory.

- **Setup:** `npm install`
- **Development:** `npm run dev`
- **Production Build:** `npm run build`
- **Deployment:** `firebase deploy`

## Development Conventions

- **Mobile-First:** Styles are strictly optimized for mobile screens.
- **Serverless Paths:** 
    - Messages: `users/{userId}/messages`
    - Fuel Records: `users/{userId}/fuel_records`
- **Authentication:** Only authenticated owners can access their data (enforced via Firestore Security Rules).
- **Caching Note:** When deploying new PWA features, clear mobile browser cache to ensure the latest service/manifest logic is applied.

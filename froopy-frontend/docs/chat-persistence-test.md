# Chat Persistence Test Guide

## Overview
The chat persistence feature ensures that when users refresh the page during an active chat session, they return to the chat view with all messages preserved.

## How It Works

### 1. Match Storage
When a match is found, the match details are stored in localStorage:
```javascript
localStorage.setItem('activeMatch', JSON.stringify({
  matchId: data.matchId,
  partnerId: data.partnerId,
  partnerUsername: data.partnerUsername,
  timestamp: Date.now()
}));
```

### 2. Automatic Restoration
On page load, the app checks for existing active matches:
- `checkForActiveMatch()` queries Supabase for any active matches
- If found, it calls `handleMatchFound()` to restore the chat state
- The stored match in localStorage helps maintain consistency

### 3. Message Loading
When ChatService is initialized, it automatically:
- Loads all existing messages from the match
- Subscribes to real-time updates for new messages
- Displays messages in the correct order with proper sender attribution

### 4. Cleanup
When the user ends the chat (Skip button), the app:
- Ends the match in Supabase
- Cleans up the ChatService subscription
- Removes the match from localStorage
- Returns to the preferences screen

## Testing Steps

1. **Start a Chat**
   - Login to the app
   - Enter match preferences
   - Wait for a match or let the bot match trigger after 60 seconds
   - Send a few messages

2. **Refresh the Page**
   - Press F5 or refresh the browser
   - The app should:
     - Return directly to the chat view
     - Show all previous messages
     - Display the correct partner name
     - Allow continuing the conversation

3. **End the Chat**
   - Click the Skip button
   - The app should return to preferences
   - Refreshing now should NOT restore the chat

## Technical Details

### Components Involved
- `MainPage.jsx`: Main orchestrator with state management
- `MatchingService`: Checks for existing matches
- `ChatService`: Loads and manages messages
- `localStorage`: Persists active match info

### Key Functions
- `checkForActiveMatch()`: Queries Supabase for active matches
- `handleMatchFound()`: Restores chat state
- `ChatService.initialize()`: Loads existing messages
- `onSkip handler`: Cleans up and removes stored match

## Edge Cases Handled
- Bot matches are properly restored with bot profile
- Messages load in correct chronological order
- Handles both user-initiated and bot-initiated matches
- Cleans up properly to prevent stale data
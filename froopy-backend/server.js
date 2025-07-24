// server.js - Just the bones
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'https://froopychat.vercel.app'],
    credentials: true
  }
});
const cors = require('cors');

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'https://froopychat.vercel.app'],
  credentials: true
}));

app.use(express.json());

// Test route
app.get('/health', (req, res) => {
  res.json({ status: 'vibing' });
});

// Store waiting users
const waitingUsers = new Map();

// Store active matches
const activeMatches = new Map();

// Add this helper function
function checkMatch(prefs1, prefs2) {
  // If either user selected "both", it's a match
  if (prefs1.lookingFor === 'both' || prefs2.lookingFor === 'both') {
    return true;
  }
  
  // Check if preferences align
  const user1WantsUser2 = prefs1.lookingFor === prefs2.userGender;
  const user2WantsUser1 = prefs2.lookingFor === prefs1.userGender;
  
  return user1WantsUser2 && user2WantsUser1;
}

io.on('connection', (socket) => {
  console.log('Someone connected!', socket.id);
  
  // Handle find match
  socket.on('find-match', (preferences) => {
    console.log(`User ${socket.id} looking for match:`, preferences);
    
    // Try to find a compatible match
    for (const [userId, userData] of waitingUsers) {
      if (userId !== socket.id) {
        const { preferences: otherPrefs } = userData;
        
        // Check if preferences match
        const isMatch = checkMatch(preferences, otherPrefs);
        
        if (isMatch) {
          console.log(`Matching ${socket.id} with ${userId} (preferences compatible)`);
          
          io.to(socket.id).emit('match-found', { partnerId: userId });
          io.to(userId).emit('match-found', { partnerId: socket.id });

          // Store the match relationship
          activeMatches.set(socket.id, userId);
          activeMatches.set(userId, socket.id);
          
          waitingUsers.delete(userId);
          return;
        }
      }
    }
    
    // No compatible match found
    console.log(`No compatible match found, adding ${socket.id} to waiting pool`);
    waitingUsers.set(socket.id, { 
      socketId: socket.id,
      preferences,
      timestamp: Date.now() 
    });
  });
  
  // Handle cancel search
  socket.on('cancel-search', () => {
    console.log(`User ${socket.id} cancelled search`);
    waitingUsers.delete(socket.id);
  });

  // Add message handler
  socket.on('message', (message) => {
    console.log(`Message from ${socket.id}:`, message); // Keep - important for moderation
    
    // Find partner
    const partnerId = activeMatches.get(socket.id);
    
    if (partnerId) {
      // console.log(`Relaying message to ${partnerId}`); // Dev log - cleaned up
      io.to(partnerId).emit('message', {
        ...message,
        senderId: socket.id
      });
    } else {
      console.log(`No partner found for ${socket.id}`); // Keep - indicates system issue
    }
  });

  // Add typing event handlers
  socket.on('typing-start', () => {
    console.log(`User ${socket.id} started typing`); // Keep - shows user activity
    const partnerId = activeMatches.get(socket.id);
    if (partnerId) {
      // console.log(`Notifying partner ${partnerId} about typing`); // Dev log - cleaned up
      io.to(partnerId).emit('partner-typing-start');
    } else {
      // console.log('No active partner to notify about typing'); // Dev log - cleaned up
    }
  });

  socket.on('typing-stop', () => {
    console.log(`User ${socket.id} stopped typing`); // Keep - shows user activity
    const partnerId = activeMatches.get(socket.id);
    if (partnerId) {
      // console.log(`Notifying partner ${partnerId} stopped typing`); // Dev log - cleaned up
      io.to(partnerId).emit('partner-typing-stop');
    } else {
      // console.log('No active partner to notify about typing stop'); // Dev log - cleaned up
    }
  });

  // Add skip handler
  socket.on('skip', () => {
    console.log(`User ${socket.id} skipped`);
    
    const partnerId = activeMatches.get(socket.id);
    if (partnerId) {
      // Notify partner
      io.to(partnerId).emit('partner-skipped');
      
      // Clean up matches
      activeMatches.delete(socket.id);
      activeMatches.delete(partnerId);
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Clean up waiting pool
    waitingUsers.delete(socket.id);
    
    // Clean up active match
    const partnerId = activeMatches.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partner-disconnected');
      activeMatches.delete(socket.id);
      activeMatches.delete(partnerId);
    }
  });
});

server.listen(3000, () => {
  console.log('Froopy backend vibing on 3000 🚀');
});
import { io } from 'socket.io-client';

// Offline message queue system
let messageQueue = [];
let isOnline = navigator.onLine;
let queueFlushInProgress = false;

// Export queue for debugging
export const getMessageQueue = () => [...messageQueue];
export const getOnlineStatus = () => isOnline;

// Create socket instance with environment-based URL and reconnection options
const socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000', {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});

// Online/offline detection
window.addEventListener('online', () => {
  console.log('[Socket] Network online detected');
  isOnline = true;
  
  // Only flush queue if we have a socket connection
  if (socket.connected && messageQueue.length > 0) {
    flushMessageQueue();
  }
});

window.addEventListener('offline', () => {
  console.log('[Socket] Network offline detected');
  isOnline = false;
});

// Debug connection
socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
  isOnline = true;
  
  // Authenticate immediately if user is logged in
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      if (user.email) {
        console.log('Auto-authenticating socket for user:', user.email);
        socket.emit('authenticate', {
          email: user.email
        });
      }
    } catch (error) {
      console.error('Error parsing user data for authentication:', error);
    }
  }
  
  // Flush any pending messages
  if (messageQueue.length > 0) {
    flushMessageQueue();
  }
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
  // Don't set isOnline = false here, as we might still have network
});

// Authentication event handlers
socket.on('authenticated', (data) => {
  console.log('Socket authenticated successfully:', data);
});

socket.on('auth-error', (error) => {
  console.error('Socket authentication failed:', error);
});

// Match-related functions
export const findMatch = (preferences) => {
  console.log('Emitting find-match with:', preferences);
  socket.emit('find-match', preferences);
};

export const cancelSearch = () => {
  console.log('Cancelling search');
  socket.emit('cancel-search');
};

// Message-related functions
export const sendMessage = (message) => {
  console.log('Emitting message:', message);
  socket.emit('message', message);
};

export const sendSkip = () => {
  console.log('Emitting skip');
  socket.emit('skip');
};

// Reconnection event handlers
export const onReconnecting = (callback) => {
  socket.io.on('reconnect_attempt', callback);
};

export const onReconnected = (callback) => {
  socket.io.on('reconnect', callback);
};

export const onReconnectError = (callback) => {
  socket.io.on('reconnect_error', callback);
};

// Typing event functions
export const startTyping = () => {
  // console.log('Emitting typing-start event'); // Dev log - cleaned up for production
  socket.emit('typing-start');
};

export const stopTyping = () => {
  // console.log('Emitting typing-stop event'); // Dev log - cleaned up for production
  socket.emit('typing-stop');
};

export const onPartnerTypingStart = (callback) => {
  socket.on('partner-typing-start', callback);
};

export const onPartnerTypingStop = (callback) => {
  socket.on('partner-typing-stop', callback);
};

// Add message to queue
export const queueMessage = (messageData) => {
  messageQueue.push({
    ...messageData,
    queuedAt: Date.now(),
    id: `queued-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  });
  console.log('[Socket] Message queued:', messageData);
  return messageQueue[messageQueue.length - 1];
};

// Flush all queued messages
const flushMessageQueue = async () => {
  if (queueFlushInProgress || messageQueue.length === 0) {
    return;
  }
  
  console.log(`[Socket] Flushing ${messageQueue.length} queued messages`);
  queueFlushInProgress = true;
  
  // Copy queue and clear it
  const messagesToSend = [...messageQueue];
  messageQueue = [];
  
  // Send each message with a small delay to avoid overwhelming
  for (const msg of messagesToSend) {
    if (socket.connected) {
      socket.emit('message', { text: msg.text });
      console.log('[Socket] Sent queued message:', msg.text);
      
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      // If disconnected again, re-queue the remaining messages
      messageQueue.unshift(...messagesToSend.slice(messagesToSend.indexOf(msg)));
      break;
    }
  }
  
  queueFlushInProgress = false;
};

// Check if we should queue or send directly
export const canSendDirectly = () => isOnline && socket.connected;

// Manual authentication function (called when user logs in)
export const authenticateSocket = (userData) => {
  if (socket.connected && userData?.email) {
    console.log('Manually authenticating socket for user:', userData.email);
    socket.emit('authenticate', {
      email: userData.email
    });
    
    // Store in localStorage for auto-authentication on reconnect
    localStorage.setItem('user', JSON.stringify(userData));
  }
};

// Export socket for event listeners
export default socket;
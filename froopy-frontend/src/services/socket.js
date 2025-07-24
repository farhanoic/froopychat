import { io } from 'socket.io-client';

// Create socket instance with environment-based URL and reconnection options
const socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000', {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});

// Debug connection
socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
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

// Export socket for event listeners
export default socket;
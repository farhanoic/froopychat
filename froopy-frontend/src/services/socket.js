import { io } from 'socket.io-client';

// Create socket instance
const socket = io('http://localhost:3000');

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

// Export socket for event listeners
export default socket;
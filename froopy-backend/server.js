// server.js - Just the bones
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177', 'http://localhost:5178', 'https://froopychat.vercel.app'],
    credentials: true
  }
});
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ADD THIS NEW IMPORT HERE
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateBotPersona } = require('./botPersona');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Migration function - runs once when server starts
async function runMigrations() {
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS interests TEXT;
    `);
    console.log('✅ Database migrations complete');
  } catch (error) {
    console.error('Migration error:', error);
  }
}

// Initialize Gemini (ADD AFTER OTHER CONST DECLARATIONS)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177', 'http://localhost:5178', 'https://froopychat.vercel.app'],
  credentials: true
}));

app.use(express.json());

// Test route
app.get('/health', (req, res) => {
  res.json({ status: 'vibing' });
});

// Check if email exists endpoint
app.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate input
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user exists
    const result = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    console.log(`Email check for ${email}: ${result.rows.length > 0 ? 'exists' : 'new'}`);
    
    res.json({ exists: result.rows.length > 0 });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ error: 'Failed to check email' });
  }
});

// User registration endpoint
app.post('/register', async (req, res) => {
  try {
    const { email, gender, password, username } = req.body;
    
    console.log('Registration attempt:', { email, gender, username });
    
    // Validate input
    if (!email || !gender || !password || !username) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id, email, gender, username FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      console.log('User already exists:', email);
      const user = existingUser.rows[0];
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'your-secret-key');
      return res.json({ 
        success: true, 
        message: 'User already registered',
        user: { id: user.id, email: user.email, gender: user.gender, username: user.username },
        token
      });
    }
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Insert new user WITH PASSWORD
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, gender, username, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING id, email, gender, username',
      [email, passwordHash, gender, username]
    );
    
    const user = result.rows[0];
    console.log(`✅ User registered: ${user.id} (${user.username}) - ${user.email}`);
    
    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'your-secret-key');
    
    res.json({ 
      success: true, 
      message: 'User registered successfully',
      user: { id: user.id, email: user.email, gender: user.gender, username: user.username },
      token
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User login endpoint
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('Login attempt:', { email });
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user by email
    const result = await pool.query(
      'SELECT id, email, password_hash, gender, username FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      console.log('User not found:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    console.log(`✅ User logged in: ${user.id} (${user.username}) - ${user.email}`);
    
    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'your-secret-key');
    
    res.json({ 
      success: true,
      message: 'Login successful',
      user: { id: user.id, email: user.email, gender: user.gender, username: user.username },
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Test Gemini API endpoint
app.get('/test-gemini', async (req, res) => {
  try {
    console.log('Testing Gemini API...');
    
    // Simple test prompt
    const prompt = "Say 'Hello from Gemini!' in response";
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Gemini response:', text);
    
    res.json({
      success: true,
      response: text,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Gemini API error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test Gemini Hindi endpoint
app.get('/test-gemini-hindi', async (req, res) => {
  try {
    console.log('Testing Gemini Hindi support...');
    
    const prompt = "Say 'Hello' in Hindi using Devanagari script. Just the word, nothing else.";
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Gemini Hindi response:', text);
    
    res.json({
      success: true,
      response: text,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Gemini Hindi API error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test bot persona generation
app.get('/test-bot-persona', (req, res) => {
  try {
    const persona = generateBotPersona();
    res.json({
      success: true,
      persona: persona,
      message: 'Bot persona generated successfully'
    });
  } catch (error) {
    console.error('Persona generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test bot activation flow
app.get('/test-bot-activation/:userId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Check if bot is available
    if (!isBotAvailable()) {
      return res.json({
        success: false,
        message: 'Bot is currently busy',
        botState: {
          isAvailable: botState.isAvailable,
          currentUser: botState.currentUser
        }
      });
    }
    
    // For testing: add user to waiting pool temporarily
    if (!waitingUsers.has(userId)) {
      waitingUsers.set(userId, {
        socketId: 'test_socket_id',
        preferences: { genderPreference: 'any' }
      });
    }
    
    // Activate bot
    const persona = activateBotForUser(userId, 'test_socket_id');
    
    if (!persona) {
      return res.json({
        success: false,
        message: 'Failed to activate bot'
      });
    }
    
    // Test message from bot
    const testMessage = {
      from: persona.username,
      message: 'हाय',
      timestamp: new Date().toISOString(),
      isBot: true // Internal use only
    };
    
    res.json({
      success: true,
      persona: {
        username: persona.username,
        gender: persona.gender,
        avatar: persona.avatar
        // Note: Don't expose isBot flag or internal details
      },
      testMessage: testMessage,
      botState: {
        isAvailable: botState.isAvailable,
        currentUser: botState.currentUser
      }
    });
  } catch (error) {
    console.error('Bot activation test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test bot deactivation
app.get('/test-bot-deactivation', (req, res) => {
  try {
    const previousState = {
      wasAvailable: botState.isAvailable,
      hadUser: botState.currentUser
    };
    
    deactivateBot();
    
    res.json({
      success: true,
      message: 'Bot deactivated',
      previousState: previousState,
      currentState: {
        isAvailable: botState.isAvailable,
        currentUser: botState.currentUser
      }
    });
  } catch (error) {
    console.error('Bot deactivation test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test message creation
app.get('/test-bot-message', (req, res) => {
  if (!botState.currentPersona) {
    return res.status(400).json({
      success: false,
      message: 'No active bot persona'
    });
  }
  
  const testMessage = createBotMessage('कैसे हो?', botState.currentPersona);
  const typingEvent = createBotTypingEvent(botState.currentPersona, true);
  
  res.json({
    success: true,
    message: testMessage,
    typingEvent: typingEvent,
    note: 'These are test structures only, not sent via socket yet'
  });
});

// Notify all friends when user comes online/offline
async function notifyFriendsOnlineStatus(userId, isOnline) {
  try {
    // Get all friends of this user
    const friends = await getFriends(userId);
    
    console.log(`Notifying ${friends.length} friends that user ${userId} is ${isOnline ? 'online' : 'offline'}`);
    
    // Notify each online friend
    friends.forEach(friend => {
      const friendSocketId = onlineUsers.get(friend.id);
      if (friendSocketId) {
        io.to(friendSocketId).emit('friend-status-changed', {
          friendId: userId,
          isOnline
        });
      }
    });
  } catch (error) {
    console.error('Error notifying friends:', error);
  }
}

// Friend-related database functions
async function addFriend(user1Id, user2Id) {
  try {
    // Ensure user1Id is always the smaller ID for consistency
    const [smallerId, largerId] = user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
    
    // Insert friendship (will fail if already exists due to UNIQUE constraint)
    const result = await pool.query(
      'INSERT INTO friends (user1_id, user2_id) VALUES ($1, $2) RETURNING *',
      [smallerId, largerId]
    );
    
    console.log(`Friendship created between users ${smallerId} and ${largerId}`);
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      console.log(`Friendship already exists between users ${user1Id} and ${user2Id}`);
      return null;
    }
    console.error('Error adding friend:', error);
    throw error;
  }
}

async function getFriends(userId) {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.gender,
        f.created_at as friendship_date,
        COALESCE(unread.count, 0) as unread_count
      FROM friends f
      JOIN users u ON 
        CASE 
          WHEN f.user1_id = $1 THEN u.id = f.user2_id
          ELSE u.id = f.user1_id
        END
      LEFT JOIN (
        SELECT 
          sender_id,
          COUNT(*) as count
        FROM friend_messages
        WHERE receiver_id = $1 AND is_read = false
        GROUP BY sender_id
      ) unread ON unread.sender_id = u.id
      WHERE f.user1_id = $1 OR f.user2_id = $1
      ORDER BY unread.count DESC NULLS LAST, f.created_at DESC
    `, [userId]);
    
    console.log(`Found ${result.rows.length} friends for user ${userId} with unread counts`);
    return result.rows;
  } catch (error) {
    console.error('Error getting friends:', error);
    throw error;
  }
}

async function areFriends(user1Id, user2Id) {
  try {
    const [smallerId, largerId] = user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
    
    const result = await pool.query(
      'SELECT * FROM friends WHERE user1_id = $1 AND user2_id = $2',
      [smallerId, largerId]
    );
    
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking friendship:', error);
    throw error;
  }
}

// Get friend messages between two users
async function getFriendMessages(userId1, userId2, limit = 50) {
  try {
    const result = await pool.query(`
      SELECT 
        fm.id,
        fm.sender_id,
        fm.receiver_id,
        fm.message,
        fm.created_at,
        fm.is_read,
        u.username as sender_username
      FROM friend_messages fm
      JOIN users u ON fm.sender_id = u.id
      WHERE 
        (fm.sender_id = $1 AND fm.receiver_id = $2) OR 
        (fm.sender_id = $2 AND fm.receiver_id = $1)
      ORDER BY fm.created_at DESC
      LIMIT $3
    `, [userId1, userId2, limit]);
    
    // Return in chronological order (reverse the DESC query)
    return result.rows.reverse();
  } catch (error) {
    console.error('Error getting friend messages:', error);
    return [];
  }
}

// Save a friend message
async function saveFriendMessage(senderId, receiverId, message) {
  try {
    const result = await pool.query(`
      INSERT INTO friend_messages (sender_id, receiver_id, message)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [senderId, receiverId, message]);
    
    console.log(`Message saved from user ${senderId} to user ${receiverId}`);
    return result.rows[0];
  } catch (error) {
    console.error('Error saving friend message:', error);
    throw error;
  }
}

// Mark messages as read
async function markMessagesAsRead(userId, friendId) {
  try {
    const result = await pool.query(`
      UPDATE friend_messages
      SET is_read = true
      WHERE receiver_id = $1 AND sender_id = $2 AND is_read = false
      RETURNING id
    `, [userId, friendId]);
    
    console.log(`Marked ${result.rows.length} messages as read`);
    return result.rows.length;
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return 0;
  }
}

// Get unread count for a specific friend
async function getUnreadCount(userId, friendId) {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as unread_count
      FROM friend_messages
      WHERE receiver_id = $1 AND sender_id = $2 AND is_read = false
    `, [userId, friendId]);
    
    return parseInt(result.rows[0].unread_count);
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

// Search users by username, excluding self and existing friends
async function searchUsersByUsername(query, excludeUserId) {
  try {
    // Validate inputs
    if (!query || query.trim().length < 3) {
      return [];
    }
    
    const result = await pool.query(`
      SELECT u.id, u.username, u.gender 
      FROM users u
      WHERE u.username ILIKE $1 
      AND u.id != $2
      AND u.id NOT IN (
        -- Exclude existing friends (check both directions)
        SELECT CASE 
          WHEN f.user1_id = $2 THEN f.user2_id 
          ELSE f.user1_id 
        END
        FROM friends f
        WHERE f.user1_id = $2 OR f.user2_id = $2
      )
      ORDER BY u.username ASC
      LIMIT 10
    `, [`%${query.trim()}%`, excludeUserId]);
    
    console.log(`Search for "${query}" by user ${excludeUserId} returned ${result.rows.length} results`);
    return result.rows;
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

// Helper function to get userId from socket
function getUserIdFromSocket(socketId) {
  // Check activeMatches first
  for (const [userId, match] of activeMatches.entries()) {
    if (match.socket1 === socketId || match.socket2 === socketId) {
      // Determine which user this socket belongs to
      if (match.socket1 === socketId) {
        return match.user1;
      } else {
        return match.user2;
      }
    }
  }
  
  // Check waiting users - now the key is userId and we check data.socketId
  for (const [userId, data] of waitingUsers.entries()) {
    if (data.socketId === socketId) {
      return userId; // This is now the actual database user ID
    }
  }
  
  // Check online users map (userId -> socketId)
  for (const [userId, storedSocketId] of onlineUsers.entries()) {
    if (storedSocketId === socketId) {
      return userId;
    }
  }
  
  // Bot matches are already handled in activeMatches check above
  
  console.error(`No userId found for socket ${socketId}`);
  return null;
}

// Helper to get socket ID from user ID
function getSocketIdFromUserId(userId) {
  // Check online users map
  return onlineUsers.get(userId) || null;
}

// Production debug endpoint (secured)
app.get('/debug-waiting-pool', (req, res) => {
  // Only allow in development or with debug flag
  if (process.env.NODE_ENV === 'production' && !req.query.debug) {
    return res.status(403).json({ error: 'Debug endpoints disabled in production' });
  }
  
  const pool = [];
  waitingUsers.forEach((user, socketId) => {
    pool.push({
      socketId: socketId.substring(0, 8) + '...', // Shortened for privacy
      gender: user.userGender || 'unknown',
      lookingFor: user.lookingFor || 'unknown',
      interests: user.interests || 'none',
      waitingTime: Math.floor((Date.now() - user.timestamp) / 1000) + 's'
    });
  });
  res.json({ 
    totalWaiting: waitingUsers.size,
    users: pool 
  });
});

// ADD this temporary test endpoint
app.get('/test-interest-matching', (req, res) => {
  // Test cases
  const tests = [
    {
      name: 'Exact match',
      interests1: 'gaming',
      interests2: 'gaming',
      expected: true
    },
    {
      name: 'Case insensitive',
      interests1: 'Gaming',
      interests2: 'gaming',
      expected: true
    },
    {
      name: 'Partial overlap',
      interests1: 'gaming, music',
      interests2: 'music, movies',
      expected: true
    },
    {
      name: 'No overlap',
      interests1: 'gaming, coding',
      interests2: 'music, movies',
      expected: false
    },
    {
      name: 'Extra spaces',
      interests1: 'gaming , music',
      interests2: 'music, cooking',
      expected: true
    },
    {
      name: 'Empty first',
      interests1: '',
      interests2: 'gaming',
      expected: false
    },
    {
      name: 'Both empty',
      interests1: '',
      interests2: '',
      expected: false
    },
    {
      name: 'Null values',
      interests1: null,
      interests2: 'gaming',
      expected: false
    },
    {
      name: 'Multiple matches',
      interests1: 'gaming, music, coding',
      interests2: 'music, gaming, movies',
      expected: true
    },
    {
      name: 'Trailing commas',
      interests1: 'gaming, music,',
      interests2: 'music, movies',
      expected: true
    }
  ];
  
  const results = tests.map(test => ({
    ...test,
    result: hasCommonInterests(test.interests1, test.interests2),
    passed: hasCommonInterests(test.interests1, test.interests2) === test.expected
  }));
  
  const allPassed = results.every(r => r.passed);
  
  res.json({
    allTestsPassed: allPassed,
    totalTests: tests.length,
    passed: results.filter(r => r.passed).length,
    results
  });
});

// Debug endpoint to view blocked users
app.get('/debug-blocked-users', (req, res) => {
  const blockData = {};
  blockedUsers.forEach((blockedSet, userId) => {
    blockData[userId.substring(0, 8) + '...'] = Array.from(blockedSet).map(id => id.substring(0, 8) + '...');
  });
  
  res.json({
    totalUsers: blockedUsers.size,
    blocks: blockData,
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to view reports
app.get('/debug-reports', (req, res) => {
  res.json({
    totalReports: userReports.length,
    reports: userReports.slice(-50), // Last 50 reports
    reportsByReason: userReports.reduce((acc, report) => {
      acc[report.reason] = (acc[report.reason] || 0) + 1;
      return acc;
    }, {}),
    timestamp: new Date().toISOString()
  });
});

// ADD this for manual testing
app.post('/test-interest-comparison', (req, res) => {
  const { interests1, interests2 } = req.body;
  
  if (!interests1 || !interests2) {
    return res.status(400).json({ error: 'Both interests1 and interests2 required' });
  }
  
  const result = hasCommonInterests(interests1, interests2);
  
  res.json({
    interests1,
    interests2,
    hasCommonInterests: result,
    details: {
      set1: interests1.split(',').map(i => i.trim().toLowerCase()).filter(i => i),
      set2: interests2.split(',').map(i => i.trim().toLowerCase()).filter(i => i)
    }
  });
});

// Phase 3 Chunk 9: Duration Matrix Test Endpoint
app.get('/test-duration-matrix', async (req, res) => {
  const durations = ['15s', '30s', '1min', '∞'];
  const results = [];
  
  for (const duration of durations) {
    const milliseconds = parseDuration(duration);
    results.push({
      duration,
      milliseconds,
      willTimeout: milliseconds !== null,
      expectedBehavior: milliseconds === null 
        ? 'No phase transition - search indefinitely in interest phase' 
        : `Transition to gender-only phase after ${duration} (${milliseconds}ms)`
    });
  }
  
  res.json({ 
    testMatrix: results,
    currentState: {
      totalWaiting: waitingUsers.size,
      activeTimeouts: phaseTimeouts.size,
      activeMatches: activeMatches.size / 2
    },
    testInstructions: {
      '15s': 'Should transition at exactly 15 seconds',
      '30s': 'Should transition at exactly 30 seconds', 
      '1min': 'Should transition at exactly 60 seconds',
      '∞': 'Should NEVER transition - stay in interest phase indefinitely'
    }
  });
});

// Phase 3 Chunk 9: Edge Case Test Endpoint
app.post('/test-edge-case', async (req, res) => {
  const { scenario } = req.body;
  let result = { scenario, timestamp: new Date().toISOString(), passed: false, details: '' };
  
  switch(scenario) {
    case 'timeout-cleanup':
      // Check if timeouts are properly cleaned up
      const timeoutCount = phaseTimeouts.size;
      const waitingCount = waitingUsers.size;
      result.details = `Active timeouts: ${timeoutCount}, Waiting users: ${waitingCount}`;
      result.passed = timeoutCount <= waitingCount;
      break;
      
    case 'infinite-duration-logic':
      // Test infinite duration parsing
      const infiniteDuration = parseDuration('∞');
      result.details = `parseDuration('∞') returns: ${infiniteDuration}`;
      result.passed = infiniteDuration === null;
      break;
      
    case 'special-characters':
      // Test interests with special characters
      const testInterests1 = 'C++, .NET, Rock & Roll';
      const testInterests2 = 'c++, Python, Jazz & Blues';
      const hasCommon = hasCommonInterests(testInterests1, testInterests2);
      result.passed = hasCommon; // Should match on 'c++'
      result.details = `'${testInterests1}' vs '${testInterests2}' → ${hasCommon}`;
      break;
      
    case 'empty-interests-duration':
      // Test user with duration but no interests
      const emptyResult = parseDuration('30s');
      result.details = `Empty interests with 30s duration should not set timeout`;
      result.passed = emptyResult === 30000; // Duration parsed correctly
      break;
      
    case 'memory-usage':
      // Check memory usage
      const memUsage = process.memoryUsage();
      result.details = `Heap used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`;
      result.passed = memUsage.heapUsed < 100 * 1024 * 1024; // Less than 100MB
      break;
      
    default:
      result.details = 'Unknown test scenario';
      result.passed = false;
  }
  
  res.json(result);
});

// Debug endpoint for match statistics (Phase 3 Chunk 5)
app.get('/debug-match-stats', (req, res) => {
  const waitingWithInterests = Array.from(waitingUsers.values())
    .filter(u => u.interests && u.interests.length > 0);
  
  const waitingWithoutInterests = Array.from(waitingUsers.values())
    .filter(u => !u.interests || u.interests.length === 0);
  
  res.json({
    timestamp: new Date().toISOString(),
    matchingStats: global.matchStats || { phase1: 0, phase2: 0 },
    currentState: {
      totalWaiting: waitingUsers.size,
      activeMatches: activeMatches.size / 2, // Divided by 2 since each match has 2 entries
      waitingWithInterests: waitingWithInterests.length,
      waitingWithoutInterests: waitingWithoutInterests.length
    },
    waitingUsersBreakdown: {
      withInterests: waitingWithInterests.map(u => ({
        socketId: u.socketId.substring(0, 8) + '...',
        gender: u.userGender,
        lookingFor: u.lookingFor,
        interests: u.interests,
        waitingTime: Math.floor((Date.now() - u.timestamp) / 1000) + 's'
      })),
      withoutInterests: waitingWithoutInterests.map(u => ({
        socketId: u.socketId.substring(0, 8) + '...',
        gender: u.userGender,
        lookingFor: u.lookingFor,
        waitingTime: Math.floor((Date.now() - u.timestamp) / 1000) + 's'
      }))
    }
  });
});

// Debug endpoint for phase status monitoring
app.get('/debug-phase-status', (req, res) => {
  const users = [];
  waitingUsers.forEach((user, id) => {
    users.push({
      id: id.substring(0, 8) + '...',
      interests: user.interests || 'none',
      duration: user.searchDuration,
      phase: user.interestPhaseActive ? 'interests+gender' : 'gender-only',
      waitingTime: Math.floor((Date.now() - user.timestamp) / 1000) + 's',
      hasTimeout: phaseTimeouts.has(id)
    });
  });
  
  res.json({
    timestamp: new Date().toISOString(),
    totalWaiting: users.length,
    activeTimeouts: phaseTimeouts.size,
    users
  });
});

// Debug endpoint for friends
app.get('/debug-friends/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const friends = await getFriends(userId);
    res.json({
      userId,
      friendCount: friends.length,
      friends
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to add test friendship
app.post('/debug-add-friend', async (req, res) => {
  try {
    const { user1Id, user2Id } = req.body;
    const friendship = await addFriend(user1Id, user2Id);
    res.json({ success: true, friendship });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check friendship
app.get('/debug-are-friends/:user1Id/:user2Id', async (req, res) => {
  try {
    const user1Id = parseInt(req.params.user1Id);
    const user2Id = parseInt(req.params.user2Id);
    const areFriendsResult = await areFriends(user1Id, user2Id);
    res.json({ 
      user1Id, 
      user2Id, 
      areFriends: areFriendsResult 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint for username search
app.get('/debug-search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const userId = parseInt(req.query.userId) || 1; // Default to user 1
    const results = await searchUsersByUsername(query, userId);
    res.json({
      query,
      excludeUserId: userId,
      resultCount: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Store waiting users
const waitingUsers = new Map();

// Store active matches
const activeMatches = new Map();

// Track online users for friend status
const onlineUsers = new Map(); // userId -> socketId

// Track timeouts for phase transitions
const phaseTimeouts = new Map();

// ADD: Bot activation timers
const botActivationTimers = new Map();

// Blocked users tracking - Map of userId -> Set of blocked userIds
// Blocking is mutual: if A blocks B, both A->B and B->A are blocked
const blockedUsers = new Map();

// Report tracking for moderation - in production, this would go to database
const userReports = [];

// ADD: Bot state management
const botState = {
  isAvailable: true,
  currentUser: null,
  currentPersona: null,
  conversationHistory: [],
  startTime: null
};

// Bot conversation timers
const botConversationTimers = new Map();

// Timer configuration (in milliseconds)
const BOT_CONVERSATION_CONFIG = {
  warningTime: 150000,    // 2:30 - warning message
  endTime: 180000,        // 3:00 - end conversation
  testMode: false,        // Set to true for shorter timers during testing
  testWarningTime: 10000, // 10 seconds for testing
  testEndTime: 15000      // 15 seconds for testing
};

// Get timer values based on mode
function getTimerValues() {
  if (BOT_CONVERSATION_CONFIG.testMode) {
    return {
      warning: BOT_CONVERSATION_CONFIG.testWarningTime,
      end: BOT_CONVERSATION_CONFIG.testEndTime
    };
  }
  return {
    warning: BOT_CONVERSATION_CONFIG.warningTime,
    end: BOT_CONVERSATION_CONFIG.endTime
  };
}

// Clear bot conversation timer
function clearBotConversationTimer(userId) {
  if (botConversationTimers.has(userId)) {
    const timers = botConversationTimers.get(userId);
    if (timers.warningTimer) clearTimeout(timers.warningTimer);
    if (timers.endTimer) clearTimeout(timers.endTimer);
    botConversationTimers.delete(userId);
    console.log(`Cleared bot conversation timers for user ${userId}`);
  }
}

// Graceful bot disconnect
async function disconnectBotChat(userId, reason = 'timeout') {
  console.log(`Disconnecting bot chat for user ${userId}, reason: ${reason}`);
  
  const match = activeMatches.get(userId);
  if (!match || !match.isBot) {
    console.log('No active bot match found for user:', userId);
    return;
  }
  
  // Clear timers
  clearBotConversationTimer(userId);
  clearBotTimer(userId); // Clear activation timer if exists
  
  // Get user socket
  const user = await pool.query(
    'SELECT socket_id FROM active_sessions WHERE user_id = $1',
    [userId]
  );
  
  if (user.rows.length > 0) {
    const userSocketId = user.rows[0].socket_id;
    
    // Send disconnect notification
    io.to(userSocketId).emit('partner-disconnected', {
      message: reason === 'timeout' ? 'Chat time limit reached' : 'Partner disconnected'
    });
  }
  
  // Clean up active match
  activeMatches.delete(userId);
  
  // Reset bot state
  deactivateBot();
  
  console.log('Bot chat disconnected and cleaned up successfully');
}

// Function to check bot availability
function isBotAvailable() {
  return botState.isAvailable && !botState.currentUser;
}

// Enhanced bot activation with socket integration and conversation timer
function activateBotForUser(userId, userSocketId) {
  if (!isBotAvailable()) {
    console.log('Bot is not available');
    return false;
  }
  
  // Check if user is still waiting
  if (!waitingUsers.has(userId)) {
    console.log(`User ${userId} no longer waiting, skipping bot activation`);
    return false;
  }
  
  // Generate new persona for this conversation
  const persona = generateBotPersona();
  
  // Get user data
  const userData = waitingUsers.get(userId);
  
  // Update bot state
  botState.isAvailable = false;
  botState.currentUser = userId;
  botState.currentPersona = persona;
  botState.conversationHistory = [];
  botState.startTime = new Date();
  
  console.log(`Bot activated for user ${userId} as ${persona.name} (${persona.username})`);
  
  // Remove user from waiting pool
  waitingUsers.delete(userId);
  
  // Clear all timers for this user
  clearAllUserTimers(userId);
  
  // Store in activeMatches (bot as partner)
  activeMatches.set(userId, {
    partnerId: persona.id,
    partnerSocket: 'bot_socket',
    isBot: true
  });
  
  // Send match-found event to user
  io.to(userSocketId).emit('match-found', {
    partnerUsername: persona.username,
    partnerGender: persona.gender,
    partnerAvatar: persona.avatar
  });
  
  // START CONVERSATION TIMERS
  const timerValues = getTimerValues();
  console.log(`Starting bot conversation timers - Warning: ${timerValues.warning/1000}s, End: ${timerValues.end/1000}s`);
  
  // Set warning timer (2:30 or test time)
  const warningTimer = setTimeout(async () => {
    console.log('Bot conversation warning time reached');
    
    // Send warning message
    const warningMessages = [
      'waise mujhe jaana hoga thodi der mein',
      'bas 30 second aur',
      'fir milenge'
    ];
    
    // Send messages with delays
    let delay = 0;
    for (const msg of warningMessages.slice(0, 2)) { // Send first 2 messages
      setTimeout(() => {
        sendBotMessage(userId, userSocketId, msg, persona);
      }, delay);
      delay += 2000; // 2 second gap
    }
    
  }, timerValues.warning);
  
  // Set end timer (3:00 or test time)
  const endTimer = setTimeout(async () => {
    console.log('Bot conversation time limit reached');
    
    // Send goodbye message
    const goodbyeMessages = [
      'chalo bye',
      'nice talking to you! 👋'
    ];
    
    // Send final messages
    sendBotMessage(userId, userSocketId, goodbyeMessages[0], persona);
    setTimeout(() => {
      sendBotMessage(userId, userSocketId, goodbyeMessages[1], persona);
      
      // Disconnect after final message
      setTimeout(() => {
        disconnectBotChat(userId, 'timeout');
      }, 1000);
    }, 1500);
    
  }, timerValues.end);
  
  // Store timers
  botConversationTimers.set(userId, {
    warningTimer: warningTimer,
    endTimer: endTimer,
    startTime: Date.now()
  });
  
  // Log the match
  console.log(`Bot match created with 3-minute timer: User ${userId} matched with bot ${persona.username}`);
  
  return persona;
}

// Function to deactivate bot
function deactivateBot() {
  const previousUser = botState.currentUser;
  
  // Reset bot state
  botState.isAvailable = true;
  botState.currentUser = null;
  botState.currentPersona = null;
  botState.conversationHistory = [];
  botState.startTime = null;
  
  // Clean up activeMatches
  if (previousUser) {
    activeMatches.delete(previousUser);
  }
  
  console.log('Bot deactivated and available again');
}

// Language detection function
function detectLanguage(text) {
  // Always return hinglish since we want Roman script only
  return 'hinglish';
}

// Split long responses into multiple short messages
function splitIntoShortMessages(text, maxLength = 15) {
  const words = text.split(' ');
  const messages = [];
  let currentMessage = '';
  
  for (const word of words) {
    if ((currentMessage + ' ' + word).trim().split(' ').length > maxLength) {
      if (currentMessage) {
        messages.push(currentMessage.trim());
        currentMessage = word;
      }
    } else {
      currentMessage = currentMessage ? currentMessage + ' ' + word : word;
    }
  }
  
  if (currentMessage) {
    messages.push(currentMessage.trim());
  }
  
  // If text is just one long sentence, split by punctuation
  if (messages.length === 1 && messages[0].length > 50) {
    const parts = messages[0].split(/[।,]/);
    return parts.map(p => p.trim()).filter(p => p);
  }
  
  return messages.length > 0 ? messages : [text];
}

// Natural typing delay calculator (based on message length)
function calculateTypingDelay(message) {
  const baseDelay = 1000; // 1 second minimum
  const perCharDelay = 50; // 50ms per character
  const randomVariation = Math.random() * 1000; // 0-1s random variation
  
  return baseDelay + (message.length * perCharDelay) + randomVariation;
}

// Analyze user message to understand intent
function analyzeUserMessage(message) {
  // Add null check to prevent TypeError
  if (!message || typeof message !== 'string') {
    console.log('analyzeUserMessage: Invalid message parameter:', message);
    return 'general';
  }
  
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes('samajh nahi') || lowerMsg.includes('didn\'t understand')) {
    return 'confusion';
  }
  if (lowerMsg.includes('kya?') || lowerMsg === 'kya') {
    return 'clarification_needed';
  }
  if (lowerMsg.includes('phir se') || lowerMsg.includes('repeat')) {
    return 'repeat_request';
  }
  if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
    return 'greeting';
  }
  
  return 'general';
}

// Generate bot response using Gemini
async function generateBotResponse(userMessage, conversationHistory, persona, userLanguage) {
  try {
    // Build conversation context with MORE history for better understanding
    const context = conversationHistory.slice(-10).map(msg => 
      `${msg.from === 'user' ? 'User' : 'You'}: ${msg.message}`
    ).join('\n');
    
    console.log('Bot conversation context:', {
      userMessage,
      historyLength: conversationHistory.length,
      context: context
    });

    // Analyze user message for intent (add null check)
    const userIntent = analyzeUserMessage(userMessage || '');
    console.log('User intent detected:', userIntent);
    
    // Create system prompt with conversation awareness
    const systemPrompt = `You are ${persona.name}, a ${persona.age} year old girl from ${persona.city}, India chatting on a random chat app.

CRITICAL CONVERSATION RULES:
1. ALWAYS respond to what the user JUST said - NEVER ask random unrelated questions
2. If user says they didn't understand ("samajh nahi aaya"), CLARIFY what you meant
3. If user asks "kya?" or "phir se bolo", explain your last message simply
4. Stay on the SAME topic - don't jump to random topics like football
5. Use ONLY Hinglish (English letters, no Hindi script)
6. Keep messages SHORT (5-15 words)

PERSONALITY:
- Casual college girl, slightly bored
- Natural texting style, not overly enthusiastic
- Helpful when someone is confused

HOW TO HANDLE CONFUSION:
User: "sorry samajh nahi aaya" → You: "matlab I'm okay but feeling bored"
User: "kya?" → You: "I said I'm bored today"
User: "phir se bolo" → You: "main bore feel kar rahi hun"

CONVERSATION FLOW EXAMPLES:
✅ GOOD:
You: "theek hun, thoda bore ho rahi hun"
User: "samajh nahi aaya"
You: "matlab I'm fine but bored"

❌ BAD:
You: "theek hun"
User: "samajh nahi aaya"  
You: "football pasand hai?" ← NEVER DO THIS

TOPIC RESPONSES (only when relevant):
- Football/Sports: "Barcelona fan hun", "tum konsi team?"
- Personal info: Name="${persona.name}", City="${persona.city}", Age="${persona.age}"
- Boredom: "Netflix dekho", "music suno"

REMEMBER: Always respond to their CURRENT message, don't randomly change topics!`;

    // Build the prompt with context awareness
    const prompt = `${systemPrompt}

CONVERSATION HISTORY (what happened so far):
${context}

USER JUST SAID: "${userMessage}"
USER INTENT: ${userIntent}

IMPORTANT INSTRUCTIONS:
- Look at the conversation above to understand what's happening
- If user is confused (intent: confusion), explain your last message simply
- If user needs clarification (intent: clarification_needed), repeat in easier words
- NEVER ask random questions unrelated to the conversation
- Stay on the same topic unless user changes it
- Respond in Hinglish using English letters only

Based on the conversation and what they just said, reply as ${persona.name} with 1-3 short messages. Separate with ||

Your contextual response:`;

    // Generate response
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Split response by || or fallback to sentence splitter
    let messages = text.includes('||') 
      ? text.split('||').map(m => m.trim()).filter(m => m)
      : splitIntoShortMessages(text);
    
    // Ensure messages are short
    messages = messages.flatMap(msg => 
      msg.split(' ').length > 15 ? splitIntoShortMessages(msg, 10) : msg
    );
    
    // Limit to 3 messages max
    messages = messages.slice(0, 3);
    
    console.log('Bot response generated:', messages);
    return messages;
    
  } catch (error) {
    console.error('Error generating bot response:', error);
    
    // Context-aware fallbacks based on user intent
    const userIntent = analyzeUserMessage(userMessage);
    const safeMessage = userMessage || '';
    
    if (userIntent === 'confusion' || safeMessage.toLowerCase().includes('samajh nahi')) {
      return ['matlab I was saying I am bored'];
    }
    if (userIntent === 'clarification_needed' || safeMessage.toLowerCase().includes('kya')) {
      return ['I said I am feeling bored today'];
    }
    if (userIntent === 'greeting') {
      return ['hey', 'kya kar rahe ho?'];
    }
    
    // General fallbacks
    const fallbacks = [
      'sorry, samajh nahi aaya',
      'phir se bolo?',
      'hmm'
    ];
    return [fallbacks[Math.floor(Math.random() * fallbacks.length)]];
  }
}

// Send bot message with typing indicator
async function sendBotMessage(userId, socketId, message, persona) {
  const messageData = {
    from: persona.username,
    message: message,
    timestamp: new Date().toISOString(),
    avatar: persona.avatar
  };
  
  // Store in conversation history
  if (botState.conversationHistory) {
    botState.conversationHistory.push({
      from: 'bot',
      message: message,
      timestamp: messageData.timestamp
    });
  }
  
  // Send to user
  io.to(socketId).emit('message', messageData);
  
  console.log(`Bot message sent to ${userId}: ${message}`);
}

// Handle typing indicators for bot
async function sendBotTypingIndicator(socketId, username, isTyping) {
  io.to(socketId).emit('partner-typing', { 
    username: username, 
    isTyping: isTyping 
  });
}

// Prepare bot message structure (will be used in next chunk)
function createBotMessage(text, persona) {
  return {
    id: 'msg_' + Date.now(),
    from: persona.username,
    to: botState.currentUser,
    message: text,
    timestamp: new Date().toISOString(),
    avatar: persona.avatar,
    // Internal tracking, not sent to client
    _isBot: true,
    _persona: persona.name
  };
}

// Prepare bot typing indicator (will be used in next chunk)
function createBotTypingEvent(persona, isTyping) {
  return {
    username: persona.username,
    isTyping: isTyping,
    // Internal flag
    _isBot: true
  };
}

// Helper to check if two users have blocked each other
function areUsersBlocked(userId1, userId2) {
  const user1Blocks = blockedUsers.get(userId1);
  const user2Blocks = blockedUsers.get(userId2);
  
  return (user1Blocks && user1Blocks.has(userId2)) || 
         (user2Blocks && user2Blocks.has(userId1));
}

// Helper to add a mutual block
function addMutualBlock(userId1, userId2) {
  // Initialize Sets if needed
  if (!blockedUsers.has(userId1)) {
    blockedUsers.set(userId1, new Set());
  }
  if (!blockedUsers.has(userId2)) {
    blockedUsers.set(userId2, new Set());
  }
  
  // Add mutual blocks
  blockedUsers.get(userId1).add(userId2);
  blockedUsers.get(userId2).add(userId1);
  
  console.log(`🚫 Mutual block added: ${userId1} <-> ${userId2}`);
}

// ADD: Function to clear bot timer
function clearBotTimer(userId) {
  if (botActivationTimers.has(userId)) {
    clearTimeout(botActivationTimers.get(userId));
    botActivationTimers.delete(userId);
    console.log(`Cleared bot timer for user ${userId}`);
  }
}

// ADD: Function to clear all timers for a user (including bot timer)
function clearAllUserTimers(userId) {
  // Clear phase timeout (existing)
  if (phaseTimeouts.has(userId)) {
    clearTimeout(phaseTimeouts.get(userId));
    phaseTimeouts.delete(userId);
  }
  
  // Clear bot activation timer
  clearBotTimer(userId);
}

// Parse duration string to milliseconds
function parseDuration(duration) {
  const durationMap = {
    '15s': 15 * 1000,
    '30s': 30 * 1000,
    '1min': 60 * 1000,
    '∞': null // Infinite - no timeout
  };
  
  // Use hasOwnProperty to distinguish between null and undefined
  if (durationMap.hasOwnProperty(duration)) {
    return durationMap[duration]; // Returns null for ∞, number for others
  }
  return 30000; // Default 30s if invalid duration
}

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

/**
 * Checks if two users have at least one common interest
 * @param {string} interests1 - Comma-separated interests (e.g., "gaming, music")
 * @param {string} interests2 - Comma-separated interests
 * @returns {boolean} - True if at least one interest matches (case-insensitive)
 * 
 * Examples:
 * hasCommonInterests("gaming", "gaming") → true
 * hasCommonInterests("Gaming, Music", "music, movies") → true
 * hasCommonInterests("gaming", "movies") → false
 * hasCommonInterests("", "gaming") → false
 */
function hasCommonInterests(interests1, interests2) {
  // Return false if either is empty/null
  if (!interests1 || !interests2) return false;
  
  // Parse comma-separated interests into normalized sets
  const set1 = new Set(
    interests1.split(',')
      .map(i => i.trim().toLowerCase())
      .filter(i => i.length > 0) // Remove empty strings
  );
  
  const set2 = new Set(
    interests2.split(',')
      .map(i => i.trim().toLowerCase())
      .filter(i => i.length > 0)
  );
  
  // Check if any interest overlaps
  const hasOverlap = [...set1].some(interest => set2.has(interest));
  
  // Debug logging (only in development)
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔍 Interest comparison:', {
      user1: [...set1],
      user2: [...set2],
      hasCommon: hasOverlap
    });
  }
  
  return hasOverlap;
}

/**
 * Attempts to find a match for a specific user based on their current phase
 * @param {string} searchingUserId - Socket ID of user to find match for
 */
async function attemptMatch(searchingUserId) {
  const searchingUser = waitingUsers.get(searchingUserId);
  if (!searchingUser) return;

  console.log(`🔍 Attempting match for ${searchingUserId.substring(0, 8)}`, {
    phase: searchingUser.interestPhaseActive ? 'interests+gender' : 'gender-only'
  });

  // Try to find a match
  for (const [waitingUserId, waitingUser] of waitingUsers) {
    if (waitingUserId !== searchingUserId) {
      // Check if users have blocked each other
      if (areUsersBlocked(searchingUserId, waitingUserId)) {
        console.log(`🚫 Skipping blocked user: ${searchingUserId.substring(0, 8)} <-> ${waitingUserId.substring(0, 8)}`);
        continue;
      }
      
      const genderMatch = checkMatch(searchingUser, waitingUser);
      
      // Phase logic
      if (searchingUser.interestPhaseActive && waitingUser.interestPhaseActive) {
        // Both users in interest phase - need both gender AND interest match
        const interestMatch = hasCommonInterests(searchingUser.interests, waitingUser.interests);
        
        if (genderMatch && interestMatch) {
          console.log('✅ Interest match found!');
          await createMatch(searchingUserId, waitingUserId, 'Phase 1');
          return;
        }
      } else {
        // At least one user in gender-only phase - only need gender match
        if (genderMatch) {
          const phase = (searchingUser.interestPhaseActive || waitingUser.interestPhaseActive) ? 'Mixed' : 'Phase 2';
          console.log(`✅ ${phase} match found!`);
          await createMatch(searchingUserId, waitingUserId, phase);
          return;
        }
      }
    }
  }
  
  console.log('⏳ No match found yet');
}

/**
 * Creates a match between two users and handles all the setup
 * @param {string} userId1 - Socket ID of first user
 * @param {string} userId2 - Socket ID of second user
 * @param {string} phase - Which matching phase was used ('Phase 1' or 'Phase 2')
 */
async function createMatch(userId1, userId2, phase = 'Unknown') {
  // Clear all timers for both users
  clearAllUserTimers(userId1);
  clearAllUserTimers(userId2);

  const user1 = waitingUsers.get(userId1);
  const user2 = waitingUsers.get(userId2);
  
  if (!user1 || !user2) {
    console.error('❌ Cannot create match, user not found:', { userId1, userId2 });
    return false;
  }
  
  console.log(`🎉 Creating match via ${phase}:`, {
    user1: userId1.substring(0, 8) + '...',
    user2: userId2.substring(0, 8) + '...',
    user1Interests: user1.interests || 'none',
    user2Interests: user2.interests || 'none'
  });
  
  // Store active match (partnerId for compatibility with existing code)
  activeMatches.set(userId1, userId2);
  activeMatches.set(userId2, userId1);
  
  // Remove from waiting pool
  waitingUsers.delete(userId1);
  waitingUsers.delete(userId2);
  
  // Look up usernames for both users
  let user1Username, user2Username;
  try {
    const user1Result = await pool.query('SELECT username, email FROM users WHERE id = $1', [userId1]);
    const user2Result = await pool.query('SELECT username, email FROM users WHERE id = $1', [userId2]);
    
    const user1Data = user1Result.rows[0];
    const user2Data = user2Result.rows[0];
    
    // Use username if exists, otherwise generate from email
    user1Username = user1Data?.username || (user1Data?.email ? user1Data.email.split('@')[0] + Math.floor(Math.random() * 100) : null);
    user2Username = user2Data?.username || (user2Data?.email ? user2Data.email.split('@')[0] + Math.floor(Math.random() * 100) : null);
  } catch (error) {
    console.error('Error looking up usernames for match:', error);
    // Fallback to just partner IDs if username lookup fails
    user1Username = null;
    user2Username = null;
  }
  
  // Get socket IDs for emitting events
  const user1SocketId = user1.socketId;
  const user2SocketId = user2.socketId;
  
  // Notify both users with usernames included
  io.to(user1SocketId).emit('match-found', { 
    partnerId: userId2,
    partnerUsername: user2Username || `user${userId2}` // Fallback to readable format
  });
  io.to(user2SocketId).emit('match-found', { 
    partnerId: userId1,
    partnerUsername: user1Username || `user${userId1}` // Fallback to readable format
  });
  
  // Track match statistics for monitoring
  global.matchStats = global.matchStats || { phase1: 0, phase2: 0 };
  if (phase === 'Phase 1') {
    global.matchStats.phase1++;
  } else if (phase === 'Phase 2') {
    global.matchStats.phase2++;
  }
  
  console.log('📊 Match Stats:', global.matchStats);
  return true;
}

// Phase 3 Chunk 9: Performance monitoring and memory leak detection
setInterval(() => {
  const memUsage = process.memoryUsage();
  const report = {
    timestamp: new Date().toISOString(),
    waitingUsers: waitingUsers.size,
    activeMatches: activeMatches.size,
    phaseTimeouts: phaseTimeouts.size,
    memoryMB: Math.round(memUsage.heapUsed / 1024 / 1024)
  };
  
  // Alert if potential issues detected
  if (phaseTimeouts.size > waitingUsers.size) {
    console.warn('⚠️ Potential memory leak: More timeouts than waiting users', report);
  }
  
  if (memUsage.heapUsed > 100 * 1024 * 1024) {
    console.warn('⚠️ High memory usage detected', report);
  }
  
  // Log system health every 5 minutes
  console.log('📊 System Health:', report);
}, 300000); // Every 5 minutes

// Debug endpoint to check bot timers
app.get('/debug-bot-timers', (req, res) => {
  const timers = [];
  for (const [userId, timer] of botActivationTimers) {
    timers.push({
      userId: userId,
      hasTimer: true,
      isWaiting: waitingUsers.has(userId)
    });
  }
  
  res.json({
    activeTimers: timers.length,
    timers: timers,
    botState: {
      isAvailable: botState.isAvailable,
      currentUser: botState.currentUser,
      currentPersona: botState.currentPersona ? botState.currentPersona.username : null
    }
  });
});

// Test bot conversation
app.post('/test-bot-conversation', async (req, res) => {
  try {
    const { message, language = 'hindi' } = req.body;
    
    if (!botState.currentPersona) {
      // Create test persona
      botState.currentPersona = generateBotPersona();
      botState.conversationHistory = [];
    }
    
    // Test language detection
    const detectedLanguage = detectLanguage(message);
    
    // Generate response
    const responses = await generateBotResponse(
      message,
      botState.conversationHistory || [],
      botState.currentPersona,
      language
    );
    
    res.json({
      success: true,
      userMessage: message,
      detectedLanguage: detectedLanguage,
      botResponses: responses,
      persona: {
        name: botState.currentPersona.name,
        age: botState.currentPersona.age,
        city: botState.currentPersona.city
      },
      messageCount: responses.length,
      responseLengths: responses.map(r => r.split(' ').length)
    });
    
  } catch (error) {
    console.error('Test conversation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test message splitting
app.post('/test-message-split', (req, res) => {
  const { text, message } = req.body;
  const inputText = text || message || "default test message";
  const messages = splitIntoShortMessages(inputText, 10);
  
  res.json({
    success: true,
    original: inputText,
    wordCount: inputText.split(' ').length,
    parts: messages,
    messageLengths: messages.map(m => m.split(' ').length)
  });
});

// Test conversation flow
app.get('/test-full-bot-flow/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const testSocketId = 'test_socket_' + userId;
    
    // Activate bot
    if (!isBotAvailable()) {
      deactivateBot();
    }
    
    const persona = activateBotForUser(userId, testSocketId);
    
    if (!persona) {
      return res.status(500).json({ success: false, message: 'Failed to activate bot' });
    }
    
    // Simulate conversation
    const testMessages = [
      { text: 'hi', expectedLang: 'hindi' },
      { text: 'kya kar rahi ho', expectedLang: 'hinglish' },
      { text: 'कैसी हो?', expectedLang: 'hindi' }
    ];
    
    const conversation = [];
    
    for (const testMsg of testMessages) {
      const detected = detectLanguage(testMsg.text);
      const responses = await generateBotResponse(
        testMsg.text,
        botState.conversationHistory,
        persona,
        detected
      );
      
      conversation.push({
        user: testMsg.text,
        detectedLanguage: detected,
        expectedLanguage: testMsg.expectedLang,
        botResponses: responses
      });
      
      // Add to history
      botState.conversationHistory.push({
        from: 'user',
        message: testMsg.text,
        timestamp: new Date().toISOString()
      });
      
      responses.forEach(r => {
        botState.conversationHistory.push({
          from: 'bot',
          message: r,
          timestamp: new Date().toISOString()
        });
      });
    }
    
    res.json({
      success: true,
      persona: persona.name + ' from ' + persona.city,
      conversation: conversation,
      totalMessages: botState.conversationHistory.length
    });
    
  } catch (error) {
    console.error('Full flow test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint to simulate 60-second wait
app.get('/test-bot-timer/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const testSocketId = 'test_socket_' + userId;
  
  // Simulate user entering waiting pool
  waitingUsers.set(testSocketId, {
    socketId: testSocketId,
    userGender: 'male',
    lookingFor: 'female',
    interests: '',
    searchDuration: 'infinity',
    timestamp: Date.now()
  });
  
  // Set a shortened timer for testing (5 seconds instead of 60)
  const testTimer = setTimeout(() => {
    console.log(`Test timer fired for user ${testSocketId}`);
    if (waitingUsers.has(testSocketId) && isBotAvailable()) {
      const persona = activateBotForUser(testSocketId, testSocketId);
      console.log('Test bot activation result:', persona ? 'SUCCESS' : 'FAILED');
    }
  }, 5000); // 5 seconds for testing
  
  botActivationTimers.set(testSocketId, testTimer);
  
  res.json({
    success: true,
    message: 'Test timer set for 5 seconds',
    userId: testSocketId,
    checkStatus: 'GET /debug-bot-timers to monitor'
  });
});

io.on('connection', (socket) => {
  console.log('Someone connected!', socket.id);
  
  // Handle socket authentication - frontend should send this immediately after connection
  socket.on('authenticate', async (authData) => {
    try {
      const { email } = authData;
      console.log('Authentication attempt:', { email, socketId: socket.id });
      
      // Find user by email (simplified authentication for this system)
      const userResult = await pool.query(
        'SELECT id, username, gender FROM users WHERE email = $1',
        [email]
      );
      
      if (userResult.rows.length === 0) {
        console.error('Authentication failed - user not found:', email);
        socket.emit('auth-error', { message: 'Authentication failed' });
        return;
      }
      
      const user = userResult.rows[0];
      const userId = user.id;
      
      // Store user ID in socket
      socket.userId = userId;
      
      // Update or create active session
      await pool.query(`
        INSERT INTO active_sessions (user_id, socket_id, created_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) 
        DO UPDATE SET socket_id = $2, created_at = CURRENT_TIMESTAMP
      `, [userId, socket.id]);
      
      // Track online status
      onlineUsers.set(userId, socket.id);
      
      console.log(`✅ User authenticated: ${userId} (${user.username || 'no-username'}) via socket ${socket.id}`);
      socket.emit('authenticated', { 
        userId: userId, 
        username: user.username,
        success: true 
      });
      
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('auth-error', { message: 'Authentication failed' });
    }
  });
  
  // Handle find match - Phased Timeout Implementation  
  socket.on('find-match', async (preferences) => {
    // Phase 3 Chunk 9: Input validation and safety checks
    if (!preferences || typeof preferences !== 'object') {
      console.warn('Invalid preferences received from', socket.id);
      return;
    }
    
    // CRITICAL FIX: Get actual user ID from socket
    let userId = socket.userId;
    if (!userId) {
      // If socket.userId not set, try to get from active_sessions table
      try {
        const sessionResult = await pool.query(
          'SELECT user_id FROM active_sessions WHERE socket_id = $1',
          [socket.id]
        );
        if (sessionResult.rows.length > 0) {
          userId = sessionResult.rows[0].user_id;
          socket.userId = userId; // Store for future use
        }
      } catch (error) {
        console.error('Error getting user ID from session:', error);
      }
    }
    
    if (!userId) {
      console.error('No user ID found for socket:', socket.id);
      socket.emit('error', { message: 'User authentication required' });
      return;
    }
    
    // Validate and sanitize inputs
    const safePreferences = {
      userGender: ['male', 'female'].includes(preferences.userGender) ? preferences.userGender : 'male',
      lookingFor: ['male', 'female', 'both'].includes(preferences.lookingFor) ? preferences.lookingFor : 'both',
      interests: typeof preferences.interests === 'string' ? preferences.interests.substring(0, 200).trim() : '',
      searchDuration: ['15s', '30s', '1min', '∞'].includes(preferences.searchDuration) ? preferences.searchDuration : '30s'
    };
    
    console.log('🎯 Find-match request:', {
      userId: userId,
      socketId: socket.id.substring(0, 8) + '...',
      gender: safePreferences.userGender,
      lookingFor: safePreferences.lookingFor,
      interests: safePreferences.interests || 'none',
      duration: safePreferences.searchDuration
    });

    // Clear any existing timeout for this user - use userId now
    if (phaseTimeouts.has(userId)) {
      clearTimeout(phaseTimeouts.get(userId));
      phaseTimeouts.delete(userId);
    }

    // CRITICAL FIX: Store user in waiting pool with USER ID as key, not socket ID
    waitingUsers.set(userId, {
      userId: userId,
      socketId: socket.id,
      userGender: safePreferences.userGender,
      lookingFor: safePreferences.lookingFor,
      interests: safePreferences.interests,
      searchDuration: safePreferences.searchDuration,
      interestPhaseActive: !!(safePreferences.interests && safePreferences.interests.length > 0),
      timestamp: Date.now()
    });

    // Set up phase transition timeout if not infinite and has interests
    const duration = parseDuration(safePreferences.searchDuration);
    if (duration !== null && safePreferences.interests && safePreferences.interests.length > 0) {
      console.log(`⏰ Setting phase timeout: ${safePreferences.searchDuration}`);
      
      const timeoutId = setTimeout(async () => {
        const user = waitingUsers.get(userId);
        if (user && user.interestPhaseActive) {
          console.log(`🔄 Phase transition for user ${userId}: Interest → Gender-only`);
          user.interestPhaseActive = false;
          
          // Emit phase change to user via socket
          socket.emit('search-phase-changed', { phase: 'gender-only' });
          
          // Try matching again with gender-only
          await attemptMatch(userId);
        }
        phaseTimeouts.delete(userId);
      }, duration);
      
      phaseTimeouts.set(userId, timeoutId);
    }

    // ADD: Set up 60-second bot activation timer
    const botTimer = setTimeout(() => {
      console.log(`60 seconds elapsed for user ${userId}, checking for bot activation...`);
      
      // Check if user is still waiting and bot is available
      if (waitingUsers.has(userId) && isBotAvailable()) {
        console.log(`Activating bot for user ${userId}`);
        activateBotForUser(userId, socket.id);
      } else {
        console.log(`Bot activation skipped for user ${userId} - waiting: ${waitingUsers.has(userId)}, bot available: ${isBotAvailable()}`);
      }
    }, 60000); // 60 seconds
    
    // Store the timer reference
    botActivationTimers.set(userId, botTimer);
    console.log(`Bot activation timer set for user ${userId} - will activate in 60 seconds if no match`);

    // Attempt initial match
    await attemptMatch(userId);
  });
  
  // Handle cancel search
  socket.on('cancel-search', () => {
    const userId = socket.userId || getUserIdFromSocket(socket.id);
    console.log(`User ${userId} (socket: ${socket.id}) cancelled search`);
    
    if (userId) {
      // Clear all timers for this user
      clearAllUserTimers(userId);
      
      waitingUsers.delete(userId);
    }
  });

  // Add message handler
  socket.on('message', async (data) => {
    console.log('Message received:', data);
    const userId = socket.id;
    
    if (!userId) {
      console.error('No userId in socket for message');
      return;
    }

    const match = activeMatches.get(userId);
    if (!match) {
      console.error('No active match for user:', userId);
      return;
    }

    // Check if this is a bot conversation
    if (match.isBot) {
      console.log('Message to bot:', data.message);
      
      // Check if conversation should have ended
      const timeInfo = getRemainingBotTime(userId);
      if (timeInfo && timeInfo.shouldEnd) {
        console.log('Message rejected - conversation time exceeded');
        return;
      }
      
      // Detect user's language
      const userLanguage = detectLanguage(data.message);
      console.log('Detected language:', userLanguage);
      
      // Store user message in history
      botState.conversationHistory.push({
        from: 'user',
        message: data.message,
        timestamp: new Date().toISOString()
      });
      
      // Generate bot responses
      const botResponses = await generateBotResponse(
        data.message,
        botState.conversationHistory,
        botState.currentPersona,
        userLanguage
      );
      
      // Send messages with natural delays
      let delay = 0;
      for (const response of botResponses) {
        const typingDuration = calculateTypingDelay(response);
        
        // Schedule typing indicator
        setTimeout(() => {
          sendBotTypingIndicator(socket.id, botState.currentPersona.username, true);
        }, delay);
        
        // Schedule message
        setTimeout(() => {
          sendBotTypingIndicator(socket.id, botState.currentPersona.username, false);
          sendBotMessage(userId, socket.id, response, botState.currentPersona);
        }, delay + typingDuration);
        
        delay += typingDuration + 500; // 500ms gap between messages
      }
      
    } else {
      // Existing logic for human-to-human chat
      // For human matches, match IS the partner socket ID directly
      const partnerSocket = match;
      io.to(partnerSocket).emit('message', {
        from: data.from,
        message: data.text || data.message,  // Handle both text and message properties
        timestamp: data.timestamp,
        avatar: data.avatar
      });
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
    console.log('Skip requested by:', socket.userId);
    const userId = socket.userId;
    
    if (!userId) return;

    const match = activeMatches.get(userId);
    if (match) {
      // If skipping a bot conversation
      if (match.isBot) {
        console.log('User skipping bot conversation');
        
        // Clear conversation timers
        clearBotConversationTimer(userId);
        
        // Send a quick goodbye
        if (botState.currentPersona) {
          sendBotMessage(userId, socket.id, 'bye! 👋', botState.currentPersona);
        }
        
        // Disconnect bot chat
        setTimeout(() => {
          disconnectBotChat(userId, 'skip');
        }, 500);
        
        return; // Exit early for bot skip
      }
      
      // Rest of existing skip logic for human partners...
      const partnerId = match.partnerId;
      const partnerSocket = match.partnerSocket;
      
      // Notify partner
      io.to(partnerSocket).emit('partner-disconnected', {
        message: 'Partner skipped the conversation'
      });
      
      // Clean up matches
      activeMatches.delete(userId);
      activeMatches.delete(partnerId);
    }
  });

  // Handle user blocking
  socket.on('block-user', ({ blockedUserId }) => {
    console.log(`⚠️ Block request: ${socket.id.substring(0, 8)} wants to block ${blockedUserId.substring(0, 8)}`);
    
    // Verify both users exist and are in an active match
    const userMatch = activeMatches.get(socket.id);
    if (!userMatch || userMatch !== blockedUserId) {
      console.error('❌ Block failed: Users not in active match');
      return;
    }
    
    // Add mutual block
    addMutualBlock(socket.id, blockedUserId);
    
    // Disconnect both users from current chat
    io.to(socket.id).emit('partner-disconnected');
    io.to(blockedUserId).emit('partner-disconnected');
    
    // Clean up the match
    activeMatches.delete(socket.id);
    activeMatches.delete(blockedUserId);
    
    // Notify both users
    io.to(socket.id).emit('user-blocked', { 
      message: 'User blocked. Finding new match...',
      blockedUser: blockedUserId 
    });
    
    io.to(blockedUserId).emit('blocked-by-user', {
      message: 'You have been blocked. Finding new match...'
    });
    
    console.log(`✅ Block completed: ${socket.id.substring(0, 8)} <-> ${blockedUserId.substring(0, 8)}`);
  });

  // Handle user reporting
  socket.on('report-user', (reportData) => {
    console.log(`⚠️ User report received:`, reportData);
    
    // Validate report data
    if (!reportData.reportedUserId || !reportData.reason) {
      console.error('❌ Invalid report data');
      return;
    }
    
    // Verify reporter is in active match with reported user
    const userMatch = activeMatches.get(socket.id);
    if (!userMatch || userMatch !== reportData.reportedUserId) {
      console.error('❌ Report failed: Users not in active match');
      return;
    }
    
    // Log the report
    const report = {
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      reporterId: socket.id,
      reportedUserId: reportData.reportedUserId,
      reportedUsername: reportData.reportedUsername,
      reason: reportData.reason,
      timestamp: reportData.timestamp || new Date().toISOString(),
      matchId: userMatch
    };
    
    userReports.push(report);
    
    console.log(`✅ Report logged:`, {
      reportId: report.id,
      reason: report.reason,
      reported: report.reportedUsername
    });
    
    // Acknowledge receipt
    socket.emit('report-acknowledged', {
      reportId: report.id,
      message: 'Report received. Thank you for helping keep Froopy safe.'
    });
  });
  
  // Friend system events
  socket.on('add-friend', async ({ partnerId, partnerUsername }) => {
    console.log('Add friend request received:', { partnerId, partnerUsername });
    
    try {
      // Get the current user's ID from the socket
      const userId = getUserIdFromSocket(socket.id);
      
      if (!userId) {
        socket.emit('error', { message: 'User not found' });
        return;
      }
      
      if (!partnerId || partnerId === 'bot') {
        socket.emit('error', { message: 'Cannot add bot as friend' });
        return;
      }
      
      // Check if they're already friends
      const alreadyFriends = await areFriends(userId, partnerId);
      if (alreadyFriends) {
        socket.emit('friend-already-added', { 
          friendId: partnerId, 
          friendUsername: partnerUsername 
        });
        return;
      }
      
      // Add the friendship
      const friendship = await addFriend(userId, partnerId);
      
      if (friendship) {
        console.log(`Friendship created: User ${userId} added User ${partnerId} as friend`);
        
        // Notify the user who initiated
        socket.emit('friend-added', { 
          friendId: partnerId, 
          friendUsername: partnerUsername 
        });
        
        // Trigger friends list refresh
        // Instead of emitting, directly get and send updated friends list
        try {
          const friends = await getFriends(userId);
          const friendsWithStatus = friends.map(friend => ({
            ...friend,
            isOnline: onlineUsers.has(friend.id)
          }));
          socket.emit('friends-list', friendsWithStatus);
        } catch (error) {
          console.error('Error refreshing friends list after add:', error);
        }
        
        // Optionally notify the partner if they're online
        const partnerMatch = activeMatches.get(partnerId);
        if (partnerMatch) {
          const partnerSocketId = partnerMatch.socket1 === socket.id ? 
            partnerMatch.socket2 : partnerMatch.socket1;
          
          io.to(partnerSocketId).emit('friend-added-by', {
            friendId: userId,
            message: 'You were added as a friend!'
          });
        }
      }
    } catch (error) {
      console.error('Error adding friend:', error);
      socket.emit('error', { message: 'Failed to add friend' });
    }
  });

  // Handle get friends list
  socket.on('get-friends', async () => {
    console.log('Get friends request from socket:', socket.id);
    
    try {
      const userId = getUserIdFromSocket(socket.id);
      
      if (!userId) {
        console.log('No userId found for get-friends request');
        socket.emit('friends-list', []);
        return;
      }
      
      // Check if this is a new online session
      const wasOffline = !onlineUsers.has(userId) || onlineUsers.get(userId) !== socket.id;
      
      // Track this user as online
      socket.userId = userId;
      onlineUsers.set(userId, socket.id);
      console.log(`User ${userId} tracked as online via get-friends`);
      
      // Get friends from database
      const friends = await getFriends(userId);
      
      // Include online status
      const friendsWithStatus = friends.map(friend => ({
        ...friend,
        isOnline: onlineUsers.has(friend.id)
      }));
      
      console.log(`Sending ${friendsWithStatus.length} friends to user ${userId}`);
      socket.emit('friends-list', friendsWithStatus);
      
      // Notify friends that this user is online (only if newly online)
      if (wasOffline) {
        await notifyFriendsOnlineStatus(userId, true);
      }
    } catch (error) {
      console.error('Error getting friends:', error);
      socket.emit('friends-list', []);
    }
  });

  // Search users by username
  socket.on('search-users', async ({ query }) => {
    console.log('Search users request:', { query, socketId: socket.id });
    
    try {
      // Get current user ID
      const userId = getUserIdFromSocket(socket.id);
      
      if (!userId) {
        console.log('No userId found for search request');
        socket.emit('search-results', []);
        return;
      }
      
      // Don't search for very short queries
      if (!query || query.trim().length < 3) {
        socket.emit('search-results', []);
        return;
      }
      
      // Perform search
      const results = await searchUsersByUsername(query, userId);
      
      // Add online status to results
      const resultsWithStatus = results.map(user => ({
        ...user,
        isOnline: onlineUsers.has(user.id),
        isFriend: false // These are all non-friends by definition
      }));
      
      console.log(`Sending ${resultsWithStatus.length} search results for query "${query}"`);
      socket.emit('search-results', resultsWithStatus);
    } catch (error) {
      console.error('Error in search-users:', error);
      socket.emit('search-results', []);
    }
  });

  // Add friend from search
  socket.on('add-friend-from-search', async ({ friendId, friendUsername }) => {
    console.log('Add friend from search:', { friendId, friendUsername });
    
    try {
      const userId = getUserIdFromSocket(socket.id);
      
      if (!userId || !friendId) {
        socket.emit('error', { message: 'Invalid user data' });
        return;
      }
      
      // Check if already friends (double-check)
      const alreadyFriends = await areFriends(userId, friendId);
      if (alreadyFriends) {
        socket.emit('friend-already-added', { 
          friendId, 
          friendUsername 
        });
        return;
      }
      
      // Add friendship
      const friendship = await addFriend(userId, friendId);
      
      if (friendship) {
        // Notify user
        socket.emit('friend-added', { 
          friendId, 
          friendUsername 
        });
        
        // Send updated friends list
        socket.emit('get-friends');
        
        // Clear search results
        socket.emit('search-results', []);
      }
    } catch (error) {
      console.error('Error adding friend from search:', error);
      socket.emit('error', { message: 'Failed to add friend' });
    }
  });

  // Friend chat - get message history
  socket.on('get-friend-messages', async ({ friendId }) => {
    console.log('Get friend messages request:', { friendId, socketId: socket.id });
    
    try {
      const userId = getUserIdFromSocket(socket.id);
      
      if (!userId || !friendId) {
        socket.emit('friend-messages', { friendId, messages: [] });
        return;
      }
      
      // Check if they are actually friends
      const areFriendsCheck = await areFriends(userId, friendId);
      if (!areFriendsCheck) {
        socket.emit('error', { message: 'Not friends with this user' });
        return;
      }
      
      // Get message history
      const messages = await getFriendMessages(userId, friendId);
      
      // Mark messages as read
      await markMessagesAsRead(userId, friendId);
      
      // Get friend info
      const friendResult = await pool.query(
        'SELECT id, username, gender FROM users WHERE id = $1',
        [friendId]
      );
      
      if (friendResult.rows.length === 0) {
        socket.emit('error', { message: 'Friend not found' });
        return;
      }
      
      const friendInfo = {
        ...friendResult.rows[0],
        isOnline: onlineUsers.has(friendId)
      };
      
      console.log(`Sending ${messages.length} messages for friend chat`);
      socket.emit('friend-messages', { 
        friendId, 
        friendInfo,
        messages 
      });
    } catch (error) {
      console.error('Error getting friend messages:', error);
      socket.emit('friend-messages', { friendId, messages: [] });
    }
  });

  // Friend chat - send message
  socket.on('friend-message', async ({ friendId, message }) => {
    console.log('Friend message:', { friendId, message: message.substring(0, 50) });
    
    try {
      const userId = getUserIdFromSocket(socket.id);
      
      if (!userId || !friendId || !message) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }
      
      // Verify friendship
      const areFriendsCheck = await areFriends(userId, friendId);
      if (!areFriendsCheck) {
        socket.emit('error', { message: 'Not friends with this user' });
        return;
      }
      
      // Save message to database
      const savedMessage = await saveFriendMessage(userId, friendId, message);
      
      // Add sender info
      const messageWithSender = {
        ...savedMessage,
        sender_username: (await pool.query(
          'SELECT username FROM users WHERE id = $1', 
          [userId]
        )).rows[0].username
      };
      
      // Send back to sender for confirmation
      socket.emit('friend-message-sent', messageWithSender);
      
      // Send to friend if online
      const friendSocketId = getSocketIdFromUserId(friendId);
      if (friendSocketId) {
        io.to(friendSocketId).emit('friend-message-received', {
          ...messageWithSender,
          senderId: userId
        });
      }
    } catch (error) {
      console.error('Error sending friend message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Friend chat - user is typing
  socket.on('friend-typing', ({ friendId, isTyping }) => {
    const userId = getUserIdFromSocket(socket.id);
    
    if (!userId || !friendId) return;
    
    const friendSocketId = getSocketIdFromUserId(friendId);
    if (friendSocketId) {
      io.to(friendSocketId).emit('friend-typing-status', {
        userId,
        isTyping
      });
    }
  });

  // Exit friend chat
  socket.on('exit-friend-chat', () => {
    console.log('User exiting friend chat');
    // Could be used for cleanup or status updates
  });

  // Update unread count when messages are read
  socket.on('mark-messages-read', async ({ friendId }) => {
    try {
      const userId = getUserIdFromSocket(socket.id);
      
      if (!userId || !friendId) return;
      
      const readCount = await markMessagesAsRead(userId, friendId);
      
      if (readCount > 0) {
        console.log(`Marked ${readCount} messages as read for user ${userId} from friend ${friendId}`);
        
        // Send updated friends list with new unread counts
        socket.emit('get-friends');
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    const userId = socket.userId;
    
    // Remove from online users tracking and notify friends
    if (userId) {
      await notifyFriendsOnlineStatus(userId, false);
      onlineUsers.delete(userId);
      console.log(`User ${userId} is now offline`);
    }

    if (userId) {
      // Check if user was in bot conversation
      const match = activeMatches.get(userId);
      if (match && match.isBot) {
        console.log('User disconnected from bot conversation');
        disconnectBotChat(userId, 'disconnect');
      }
      
      // Clear all timers for this user
      clearAllUserTimers(userId);
      clearBotConversationTimer(userId);
      
      // Rest of existing disconnect logic...
      waitingUsers.delete(userId);
      
      try {
        await pool.query('DELETE FROM active_sessions WHERE user_id = $1', [userId]);
      } catch (error) {
        console.error('Error removing session:', error);
      }
    }
  });
});

// Get remaining conversation time
function getRemainingBotTime(userId) {
  if (!botConversationTimers.has(userId)) {
    return null;
  }
  
  const timer = botConversationTimers.get(userId);
  const elapsed = Date.now() - timer.startTime;
  const timers = getTimerValues();
  
  return {
    elapsed: Math.floor(elapsed / 1000),
    remaining: Math.max(0, Math.floor((timers.end - elapsed) / 1000)),
    warningReached: elapsed >= timers.warning,
    shouldEnd: elapsed >= timers.end
  };
}

// Test bot conversation with timers
app.post('/test-bot-timer-flow', async (req, res) => {
  try {
    const { testMode = true } = req.body;
    
    // Enable test mode for shorter timers
    BOT_CONVERSATION_CONFIG.testMode = testMode;
    
    const userId = 99999;
    const socketId = 'test_socket_99999';
    
    // Ensure bot is available
    if (!isBotAvailable()) {
      deactivateBot();
    }
    
    // Add to waiting pool
    waitingUsers.set(userId, {
      socketId: socketId,
      gender: 'male',
      lookingFor: 'female',
      interests: '',
      startTime: Date.now()
    });
    
    // Activate bot
    const persona = activateBotForUser(userId, socketId);
    
    if (!persona) {
      return res.status(500).json({
        success: false,
        message: 'Failed to activate bot'
      });
    }
    
    const timers = getTimerValues();
    
    res.json({
      success: true,
      message: 'Bot conversation started with timers',
      testMode: testMode,
      timers: {
        warningAt: `${timers.warning / 1000} seconds`,
        endAt: `${timers.end / 1000} seconds`
      },
      persona: {
        name: persona.name,
        username: persona.username,
        city: persona.city
      },
      checkTimer: 'GET /debug-bot-conversation-timers'
    });
    
  } catch (error) {
    console.error('Timer flow test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug bot conversation timers
app.get('/debug-bot-conversation-timers', (req, res) => {
  const activeTimers = [];
  
  for (const [userId, timers] of botConversationTimers) {
    const elapsed = Date.now() - timers.startTime;
    const elapsedSeconds = Math.floor(elapsed / 1000);
    const remainingWarning = Math.max(0, (getTimerValues().warning - elapsed) / 1000);
    const remainingEnd = Math.max(0, (getTimerValues().end - elapsed) / 1000);
    
    activeTimers.push({
      userId: userId,
      elapsedTime: `${elapsedSeconds}s`,
      warningIn: `${Math.floor(remainingWarning)}s`,
      endIn: `${Math.floor(remainingEnd)}s`,
      testMode: BOT_CONVERSATION_CONFIG.testMode
    });
  }
  
  res.json({
    activeConversations: activeTimers.length,
    timers: activeTimers,
    botState: {
      isAvailable: botState.isAvailable,
      currentUser: botState.currentUser,
      currentPersona: botState.currentPersona ? botState.currentPersona.name : null,
      conversationStarted: botState.startTime
    }
  });
});

// Test cleanup
app.post('/test-bot-cleanup', (req, res) => {
  try {
    // Force cleanup of current bot conversation
    if (botState.currentUser) {
      disconnectBotChat(botState.currentUser, 'manual');
    }
    
    // Clear all timers
    for (const [userId] of botConversationTimers) {
      clearBotConversationTimer(userId);
    }
    
    // Force reset bot state
    botState.isAvailable = true;
    botState.currentUser = null;
    botState.currentPersona = null;
    botState.conversationHistory = [];
    botState.startTime = null;
    
    // Reset test mode
    BOT_CONVERSATION_CONFIG.testMode = false;
    
    res.json({
      success: true,
      message: 'Bot cleaned up',
      botAvailable: botState.isAvailable
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

server.listen(3000, () => {
  console.log('Froopy backend vibing on 3000 🚀');
  runMigrations(); // Run database migrations on startup
});
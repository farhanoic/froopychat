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
require('dotenv').config();

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

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177', 'http://localhost:5178', 'https://froopychat.vercel.app'],
  credentials: true
}));

app.use(express.json());

// Test route
app.get('/health', (req, res) => {
  res.json({ status: 'vibing' });
});

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

// Store waiting users
const waitingUsers = new Map();

// Store active matches
const activeMatches = new Map();

// Track timeouts for phase transitions
const phaseTimeouts = new Map();

// Blocked users tracking - Map of userId -> Set of blocked userIds
// Blocking is mutual: if A blocks B, both A->B and B->A are blocked
const blockedUsers = new Map();

// Report tracking for moderation - in production, this would go to database
const userReports = [];

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
function attemptMatch(searchingUserId) {
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
          createMatch(searchingUserId, waitingUserId, 'Phase 1');
          return;
        }
      } else {
        // At least one user in gender-only phase - only need gender match
        if (genderMatch) {
          const phase = (searchingUser.interestPhaseActive || waitingUser.interestPhaseActive) ? 'Mixed' : 'Phase 2';
          console.log(`✅ ${phase} match found!`);
          createMatch(searchingUserId, waitingUserId, phase);
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
function createMatch(userId1, userId2, phase = 'Unknown') {
  // Clear phase timeouts for both users
  [userId1, userId2].forEach(userId => {
    if (phaseTimeouts.has(userId)) {
      clearTimeout(phaseTimeouts.get(userId));
      phaseTimeouts.delete(userId);
    }
  });

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
  
  // Notify both users (keeping existing match-found event structure)
  io.to(userId1).emit('match-found', { partnerId: userId2 });
  io.to(userId2).emit('match-found', { partnerId: userId1 });
  
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

io.on('connection', (socket) => {
  console.log('Someone connected!', socket.id);
  
  // Handle find match - Phased Timeout Implementation
  socket.on('find-match', (preferences) => {
    // Phase 3 Chunk 9: Input validation and safety checks
    if (!preferences || typeof preferences !== 'object') {
      console.warn('Invalid preferences received from', socket.id);
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
      socketId: socket.id.substring(0, 8) + '...',
      gender: safePreferences.userGender,
      lookingFor: safePreferences.lookingFor,
      interests: safePreferences.interests || 'none',
      duration: safePreferences.searchDuration
    });

    // Clear any existing timeout for this user
    if (phaseTimeouts.has(socket.id)) {
      clearTimeout(phaseTimeouts.get(socket.id));
      phaseTimeouts.delete(socket.id);
    }

    // Store user in waiting pool with phase flag
    waitingUsers.set(socket.id, {
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
      
      const timeoutId = setTimeout(() => {
        const user = waitingUsers.get(socket.id);
        if (user && user.interestPhaseActive) {
          console.log(`🔄 Phase transition for ${socket.id.substring(0, 8)}: Interest → Gender-only`);
          user.interestPhaseActive = false;
          
          // Emit phase change to user
          socket.emit('search-phase-changed', { phase: 'gender-only' });
          
          // Try matching again with gender-only
          attemptMatch(socket.id);
        }
        phaseTimeouts.delete(socket.id);
      }, duration);
      
      phaseTimeouts.set(socket.id, timeoutId);
    }

    // Attempt initial match
    attemptMatch(socket.id);
  });
  
  // Handle cancel search
  socket.on('cancel-search', () => {
    console.log(`User ${socket.id} cancelled search`);
    
    // Clear phase timeout
    if (phaseTimeouts.has(socket.id)) {
      clearTimeout(phaseTimeouts.get(socket.id));
      phaseTimeouts.delete(socket.id);
    }
    
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
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Clear phase timeout
    if (phaseTimeouts.has(socket.id)) {
      clearTimeout(phaseTimeouts.get(socket.id));
      phaseTimeouts.delete(socket.id);
    }
    
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
  runMigrations(); // Run database migrations on startup
});
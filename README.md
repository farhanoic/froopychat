# 🚀 Froopy Chat - Ultra-Minimal Mobile-First Chat App

**One page, zero friction, pure chat** - A lightning-fast anonymous chat application built for mobile users.

![All 6 Phases Complete](https://img.shields.io/badge/All%206%20Phases-Complete-brightgreen)
![Production Ready](https://img.shields.io/badge/Production-Ready%2090%25-success)
![Mobile First](https://img.shields.io/badge/Mobile-First-blue)
![CodeRabbit Reviews](https://img.shields.io/coderabbit/prs/github/farhanoic/froopychat?utm_source=oss&utm_medium=github&utm_campaign=farhanoic%2Ffroopychat&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

## ✨ Features

### 🎯 Complete Ultra-Minimalist Chat Experience
- ⚡ **Instant matching** - Connect with users in seconds
- 📱 **Mobile-optimized** - Perfect for iPhone SE (375px) and up
- 🎯 **Interest + Gender matching** - Two-phase matching system
- 💬 **Real-time messaging** - Socket.io powered chat
- 🔄 **Skip feature** - Move to next conversation instantly
- 🤖 **AI Bot Companion** - Indian female bot after 60 seconds
- 👥 **Friends System** - Long press to add friends, persistent chats
- 📱 **PWA Ready** - Installable on mobile home screen
- 🎨 **Ultra-minimal UI** - Dark navy theme, zero clutter

### 🚀 Advanced Features (All 6 Phases Complete)
- 📊 **Interest Matching** - Optional interests with duration control
- 🔄 **Auto-reconnection** - Handles flaky mobile networks
- 👤 **Random Avatars** - DiceBear API integration
- 🛡️ **Block/Report System** - User safety and moderation
- ⚙️ **PWA Features** - Offline support, service worker
- 🤖 **AI Conversations** - 3-minute bot conversations with natural flow
- 💬 **Friend Chats** - Persistent chat history with friends
- 📱 **Online Status** - Real-time friend online/offline indicators
- 🔔 **Unread Badges** - Message count badges with auto-refresh

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Express.js + Socket.io
- **Database**: PostgreSQL (complete Phase 6 schema)
- **AI**: Google Gemini API (bot conversations)
- **Testing**: Playwright E2E + Comprehensive verification
- **Code Reviews**: CodeRabbit AI-powered reviews
- **Mobile**: iPhone SE optimized (375x667 viewport)
- **PWA**: Service worker + manifest for installation

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL running locally

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/farhanoic/froopychat.git
   cd froopychat
   ```

2. **Setup Frontend**
   ```bash
   cd froopy-frontend
   npm install
   npm run dev
   ```

3. **Setup Backend**
   ```bash
   cd froopy-backend
   npm install
   npm start
   ```

4. **Open your browser**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000

## 📱 How It Works

### The Magic Single Page Flow
1. **Auth Page** (`/auth`) - Email + Gender selection
2. **Main Page** (`/`) - Morphs between 3 states:
   - **Preferences** - Choose who to chat with
   - **Searching** - Finding your match
   - **Chatting** - Real-time conversation

### User Journey (30 seconds total)
```
Email + Gender → Preferences → Match → Chat → Skip → Repeat
```

## 🧪 Testing (88% Pass Rate)

```bash
# Run all 43 E2E tests
cd froopy-frontend
npm run test:all

# Run specific test suites
npm test tests/e2e/auth.spec.js      # Authentication (9 tests)
npm test tests/e2e/main-page.spec.js # State transitions (10 tests)
npm test tests/e2e/chat.spec.js      # Messaging (11 tests)
npm test tests/e2e/socket.spec.js    # Real-time (8 tests)
npm test tests/e2e/navigation.spec.js # Navigation (5 tests)
```

### Test Coverage
- ✅ **Authentication Flow** - Email validation, gender selection
- ✅ **State Transitions** - Preferences → Searching → Chatting
- ✅ **Real-time Messaging** - Bidirectional chat with Socket.io
- ✅ **Mobile Optimization** - Touch targets, viewport, responsiveness
- ✅ **Skip Functionality** - Partner matching and conversation flow

## 🎨 Design System

### Colors
- **Dark Navy**: `#111928` - Primary backgrounds
- **Royal Blue**: `#2563EB` - Actions, links
- **White**: `#FEFFFE` - Text, icons  
- **Tangerine**: `#FF9B71` - Skip button, alerts

### Mobile-First Approach
- **Primary viewport**: 375x667 (iPhone SE)
- **Touch targets**: Minimum 48px height
- **Typography**: 16px minimum (prevents iOS zoom)
- **Safe areas**: Proper iOS notch handling

## 📊 Performance Metrics

- **Time to first chat**: < 30 seconds
- **Message delivery**: < 100ms
- **Mobile optimization**: 100% touch-friendly
- **Bundle size**: Optimized for mobile networks

## 🔄 Development Phases

### ✅ Phase 1 (Complete)
- Basic chat functionality
- Gender-based matching
- Mobile-optimized UI
- Real-time messaging
- Skip feature

### 🔄 Phase 2 (Planned)
- Interest-based matching
- Auto-reconnection
- PWA installation
- Typing indicators

### 🚀 Phase 3 (Future)
- AI companion bot
- Friends system
- Offline support
- Push notifications

## 🏗️ Architecture

### Frontend Structure
```
src/
├── components/
│   ├── AuthPage.jsx     # Email + gender selection
│   └── MainPage.jsx     # Morphing states (preferences/search/chat)
├── contexts/
│   └── UserContext.jsx  # User state management
└── services/
    └── socket.js        # Socket.io client connection
```

### Backend Structure
```
server.js                # Express + Socket.io server
├── Authentication       # JWT token handling
├── Matching Logic       # Gender-based pairing
└── Real-time Events     # Socket message routing
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm run test:all`)
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🎯 Philosophy

**"One page, zero friction, pure chat"** - Froopy Chat prioritizes simplicity and speed over features. Every decision is made to get users chatting faster with less complexity.

### Vibe Coding Principles
- Working code > Perfect code
- Simple solution > Clever solution  
- Mobile-first > Desktop-first
- Test after every change
- Ship broken, iterate fast

---

**Built with ❤️ by [@farhanoic](https://github.com/farhanoic)**

*Ready to chat? Try it live and connect with someone new!* 🚀
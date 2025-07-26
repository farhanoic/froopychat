import React, { useState, useEffect, useRef } from 'react';

const FriendsSheet = ({ isOpen, onClose, friends, socket, onStartChat }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [addingFriendId, setAddingFriendId] = useState(null);
  const searchTimeoutRef = useRef(null);
  
  // Clear search when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setIsSearching(false);
      setIsLoading(false);
      setAddingFriendId(null);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }
  }, [isOpen]);
  
  // Show loading when first opening
  useEffect(() => {
    if (isOpen && friends.length === 0) {
      setIsLoading(true);
      // Simulate loading
      setTimeout(() => setIsLoading(false), 500);
    }
  }, [isOpen, friends.length]);
  
  // Debounced search effect
  useEffect(() => {
    if (searchQuery.length >= 3) {
      setIsSearching(true);
      
      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      // Set new timeout for debounced search
      searchTimeoutRef.current = setTimeout(() => {
        console.log('Searching for:', searchQuery);
        socket.emit('search-users', { query: searchQuery });
      }, 300); // 300ms debounce
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
    
    // Cleanup
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, socket]);
  
  // Listen for search results
  useEffect(() => {
    const handleSearchResults = (results) => {
      console.log('Received search results:', results);
      setSearchResults(results);
      setIsSearching(false);
    };
    
    const handleFriendAdded = ({ friendUsername }) => {
      console.log('Friend added from search:', friendUsername);
      setAddingFriendId(null);
      setSearchQuery(''); // Clear search after successful add
    };
    
    socket.on('search-results', handleSearchResults);
    socket.on('friend-added', handleFriendAdded);
    
    return () => {
      socket.off('search-results', handleSearchResults);
      socket.off('friend-added', handleFriendAdded);
    };
  }, [socket]);
  
  // Handle adding friend from search
  const handleAddFriend = (user) => {
    console.log('Adding friend:', user);
    setAddingFriendId(user.id);
    socket.emit('add-friend-from-search', {
      friendId: user.id,
      friendUsername: user.username
    });
  };
  
  // Handle escape key and body scroll lock
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when sheet is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);
  
  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  // Handle swipe down to close (mobile)
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientY);
  };
  
  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };
  
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isSwipeDown = distance < -50;
    if (isSwipeDown) {
      onClose();
    }
  };
  
  return (
    <div 
      className={`fixed inset-0 z-50 transition-all duration-300
                  ${isOpen ? 'visible' : 'invisible'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="friends-sheet-title"
    >
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black transition-opacity duration-300
                   ${isOpen ? 'bg-opacity-50' : 'bg-opacity-0'}`}
        onClick={handleBackdropClick}
      />
      
      {/* Sheet */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-dark-navy
                    rounded-t-3xl transition-all duration-300 ease-out
                    max-h-[80vh] flex flex-col shadow-2xl
                    ${isOpen ? 'translate-y-0' : 'translate-y-full'}
                    ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        style={{
          // Ensure safe area for iPhone notch/home indicator
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-white/20 rounded-full" />
        </div>
        
        {/* Header */}
        <div className="px-4 pb-3">
          <h2 id="friends-sheet-title" className="text-white text-xl font-semibold">
            Friends {friends.length > 0 && `(${friends.length})`}
          </h2>
        </div>
        
        {/* Search input */}
        <div className="px-4 pb-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search username to add..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 rounded-full
                       text-white placeholder-white/50 outline-none
                       focus:bg-white/20 transition-colors pr-10"
            />
            {/* Search icon or loading spinner */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isSearching ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white 
                              rounded-full animate-spin" />
              ) : searchQuery.length >= 3 ? (
                <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              ) : null}
            </div>
          </div>
          {searchQuery.length > 0 && searchQuery.length < 3 && (
            <p className="text-white/30 text-xs mt-1 px-4">
              Type at least 3 characters to search
            </p>
          )}
        </div>
        
        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-4 pb-8 min-h-[200px]">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white 
                              rounded-full animate-spin" />
            </div>
          ) : searchQuery.length >= 3 ? (
            // Show search results
            isSearching ? (
              <div className="text-white/50 text-center py-8">
                Searching for "{searchQuery}"...
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                <p className="text-white/50 text-sm mb-3">
                  Found {searchResults.length} user{searchResults.length !== 1 ? 's' : ''}
                </p>
                {searchResults.map(user => (
                  <SearchResultItem 
                    key={user.id} 
                    user={user} 
                    onAdd={handleAddFriend}
                    isAdding={addingFriendId === user.id}
                  />
                ))}
              </div>
            ) : (
              <div className="text-white/50 text-center py-8">
                <p>No users found matching "{searchQuery}"</p>
                <p className="text-sm mt-2">Try a different username</p>
              </div>
            )
          ) : (
            // Show friends list (existing code)
            friends.length > 0 ? (
              <div className="space-y-2">
                {friends.map(friend => (
                  <FriendItem key={friend.id} friend={friend} onStartChat={onStartChat} />
                ))}
              </div>
            ) : (
              <div className="text-white/50 text-center py-8">
                <p className="mb-2">No friends yet</p>
                <p className="text-sm">Search for usernames above or long press during chat!</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

// Search result item component
const SearchResultItem = ({ user, onAdd, isAdding }) => {
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 
                    rounded-xl hover:bg-white/10 transition-colors">
      <div className="flex items-center space-x-3">
        {/* Avatar */}
        <div className="relative">
          <img
            src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${user.username}&backgroundColor=2563EB`}
            alt={user.username}
            className="w-10 h-10 rounded-full"
          />
          {/* Online indicator */}
          {user.isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 
                          rounded-full border-2 border-dark-navy" />
          )}
        </div>
        
        {/* User info */}
        <div>
          <p className="text-white font-medium">{user.username}</p>
          <p className="text-white/50 text-sm">
            {user.gender === 'male' ? '👨' : '👩'} {user.isOnline ? '• Online' : '• Offline'}
          </p>
        </div>
      </div>
      
      {/* Add button */}
      <button 
        onClick={() => onAdd(user)}
        disabled={isAdding}
        className={`px-4 py-2 rounded-full text-sm font-medium
                   transition-all duration-200
                   ${isAdding 
                     ? 'bg-white/10 text-white/50 cursor-not-allowed' 
                     : 'bg-royal-blue text-white hover:bg-blue-600 active:scale-95'}`}
      >
        {isAdding ? (
          <span className="flex items-center space-x-1">
            <div className="w-3 h-3 border border-white/50 border-t-white 
                          rounded-full animate-spin" />
            <span>Adding...</span>
          </span>
        ) : (
          'Add Friend'
        )}
      </button>
    </div>
  );
};

// Friend item component
const FriendItem = ({ friend, onStartChat }) => {
  return (
    <div 
      onClick={() => onStartChat(friend.id)}
      className="flex items-center justify-between p-3 bg-white/5 
                 rounded-xl hover:bg-white/10 transition-colors
                 cursor-pointer active:scale-[0.98] relative"
    >
      <div className="flex items-center space-x-3">
        {/* Avatar with online indicator */}
        <div className="relative">
          <img
            src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${friend.username}&backgroundColor=2563EB`}
            alt={friend.username}
            className="w-10 h-10 rounded-full"
          />
          {/* Online indicator */}
          {friend.isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 
                          rounded-full border-2 border-dark-navy animate-pulse" />
          )}
        </div>
        
        {/* User info with unread indicator */}
        <div className="flex-1">
          <p className="text-white font-medium flex items-center gap-2">
            {friend.username}
            {friend.unread_count > 0 && (
              <span className="inline-flex items-center justify-center 
                             bg-tangerine text-white text-xs font-bold 
                             rounded-full min-w-[20px] h-5 px-1">
                {friend.unread_count > 99 ? '99+' : friend.unread_count}
              </span>
            )}
          </p>
          <p className="text-white/50 text-sm">
            {friend.isOnline ? '🟢 Online' : '⚫ Offline'}
            {friend.unread_count > 0 && ` • ${friend.unread_count} unread`}
          </p>
        </div>
      </div>
      
      {/* Chat button */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onStartChat(friend.id);
        }}
        className={`text-sm font-medium transition-colors
                   ${friend.unread_count > 0 
                     ? 'text-tangerine hover:text-orange-400' 
                     : 'text-royal-blue hover:text-blue-400'}`}
      >
        Chat
      </button>
    </div>
  );
};

export default FriendsSheet;
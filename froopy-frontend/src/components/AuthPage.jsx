import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { authenticateSocket } from '../services/socket';

// Username generator function
const generateUsername = () => {
  const adjectives = [
    'cool', 'happy', 'swift', 'brave', 'calm',
    'eager', 'jolly', 'kind', 'neat', 'proud',
    'quick', 'sharp', 'witty', 'bold', 'clever'
  ];
  
  const animals = [
    'panda', 'otter', 'tiger', 'eagle', 'shark',
    'wolf', 'bear', 'fox', 'hawk', 'lion',
    'duck', 'owl', 'cat', 'dog', 'rabbit'
  ];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const number = Math.floor(Math.random() * 900) + 100; // 100-999
  
  return `${adjective}${animal}${number}`;
};

function AuthPage() {
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { setUser } = useUser();  
  const navigate = useNavigate();
  

  const handleContinue = async () => {
    if (isProcessing) return; // Prevent multiple clicks
    
    console.log('handleContinue called with:', { email, password, gender, username });
    setIsProcessing(true);
    
    try {
      let validationPassed = true;
      
      if (!email || !email.includes('@')) {
        console.log('Email validation failed:', email);
        alert('Please enter a valid email');
        validationPassed = false;
      }
      
      if (!password || password.length < 6) {
        console.log('Password validation failed:', password);
        alert('Password must be at least 6 characters');
        validationPassed = false;
      }
      
      if (!gender) {
        console.log('Gender validation failed:', gender);
        alert('Please select your gender');
        validationPassed = false;
      }
      
      if (!username) {
        console.log('Username validation failed:', username);
        alert('Username not generated');
        validationPassed = false;
      }
      
      // Only proceed if all validations passed
      if (validationPassed) {
        const userData = { email, gender, password, username };
        console.log('All validations passed. Registering user:', userData);
        
        try {
          // Register user in database
          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData)
          });
          
          const result = await response.json();
          
          if (result.success) {
            console.log('User registered successfully:', result);
            setUser(userData);
            
            // Authenticate socket immediately
            authenticateSocket(userData);
            
            console.log('Calling navigate to /');
            navigate('/');
          } else {
            console.error('Registration failed:', result);
            alert('Registration failed. Please try again.');
          }
        } catch (error) {
          console.error('Registration error:', error);
          alert('Registration failed. Please check your connection and try again.');
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenderSelect = (selectedGender) => {
    console.log('handleGenderSelect called with:', { email, password, selectedGender });
    
    if (!email || !email.includes('@')) {
      alert('Please enter your email first');
      return;
    }
    
    if (!password || password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    
    setGender(selectedGender);
    if (!username) { // Only generate once
      try {
        const generatedUsername = generateUsername();
        setUsername(generatedUsername);
      } catch (error) {
        console.error('Error generating username:', error);
        // Fallback username if generation fails
        const fallbackUsername = `user${Date.now()}`;
        setUsername(fallbackUsername);
        alert('Username generation failed, using fallback. Please continue.');
      }
    }
    
    console.log('After gender selection:', { email, password, gender: selectedGender });
  };

  return (
    <div className="min-h-screen bg-dark-navy flex flex-col items-center justify-center p-4">
      <h1 className="text-white text-3xl mb-8">Froopy</h1>
      
      {!gender ? (
        <>
          <input 
            type="email"
            placeholder="Your email"
            className="w-full max-w-xs p-4 rounded-full bg-white/10 text-white placeholder-white/50"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          
          <input
            type="password"
            placeholder="Choose a password"
            className="w-full max-w-xs p-4 rounded-full bg-white/10 text-white placeholder-white/50 mt-4"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          
          <div className="flex gap-4 mt-6">
            <button 
              onClick={() => handleGenderSelect('male')}
              className="text-6xl hover:scale-110 transition-transform"
            >
              👨
            </button>
            <button 
              onClick={() => handleGenderSelect('female')}
              className="text-6xl hover:scale-110 transition-transform"
            >
              👩
            </button>
          </div>
        </>
      ) : (
        <>
          {gender && username && (
            <div className="text-center mt-6 mb-4">
              <p className="text-white/70 text-sm">You'll be known as:</p>
              <p className="text-white text-xl font-medium mt-1">{username}</p>
            </div>
          )}
          <button 
            onClick={handleContinue}
            disabled={isProcessing}
            className="bg-royal-blue text-white px-8 py-4 rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Continue'}
          </button>
        </>
      )}
    </div>
  );
}

export default AuthPage;
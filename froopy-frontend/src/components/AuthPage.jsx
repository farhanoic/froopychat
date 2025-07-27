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
  const [step, setStep] = useState('email'); // 'email' or 'auth'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState('');
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { setUser } = useUser();  
  const navigate = useNavigate();
  
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  

  // Handle email submission and check if user exists
  const handleEmailContinue = async () => {
    if (isProcessing) return;
    
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Check if user exists
      const response = await fetch(`${API_URL}/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const { exists } = await response.json();
      setIsExistingUser(exists);
      setStep('auth');
      
      console.log(`Email ${email} ${exists ? 'exists' : 'is new'} - showing ${exists ? 'login' : 'signup'} flow`);
    } catch (error) {
      console.error('Email check error:', error);
      alert('Connection error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle authentication (login or register)
  const handleAuth = async () => {
    if (isProcessing) return;
    
    // Validate password
    if (!password || password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    
    // For new users, validate gender selection
    if (!isExistingUser && !gender) {
      alert('Please select your gender');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      if (isExistingUser) {
        // Login existing user
        const response = await fetch(`${API_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          console.log('Login successful:', result.user.username);
          setUser(result.user);
          localStorage.setItem('token', result.token);
          authenticateSocket(result.user);
          navigate('/');
        } else {
          alert(result.error || 'Login failed. Please check your password.');
        }
      } else {
        // Register new user
        const username = generateUsername();
        const userData = { email, password, gender, username };
        
        const response = await fetch(`${API_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          console.log('Registration successful:', result.user.username);
          setUser(result.user);
          localStorage.setItem('token', result.token);
          authenticateSocket(result.user);
          navigate('/');
        } else {
          alert(result.error || 'Registration failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      alert('Connection error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-navy flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-white text-3xl text-center mb-8">Froopy</h1>
        
        {step === 'email' && (
          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleEmailContinue()}
              className="w-full px-4 py-3 bg-white/10 text-white placeholder-white/50 rounded-full focus:outline-none focus:ring-2 focus:ring-royal-blue"
            />
            <button
              onClick={handleEmailContinue}
              disabled={isProcessing}
              className="w-full py-3 bg-royal-blue text-white rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {isProcessing ? 'Checking...' : 'Continue'}
            </button>
          </div>
        )}
        
        {step === 'auth' && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <p className="text-white/70 text-sm">
                {isExistingUser ? 'Welcome back!' : 'Create your account'}
              </p>
              <p className="text-white text-lg">{email}</p>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); handleAuth(); }} className="space-y-4">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 text-white placeholder-white/50 rounded-full focus:outline-none focus:ring-2 focus:ring-royal-blue"
                required
                minLength={6}
                autoComplete={isExistingUser ? "current-password" : "new-password"}
              />
              
              {!isExistingUser && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setGender('male')}
                    className={`flex-1 py-3 rounded-full text-sm font-medium transition-colors ${
                      gender === 'male' 
                        ? 'bg-royal-blue text-white' 
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    👨 Male
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('female')}
                    className={`flex-1 py-3 rounded-full text-sm font-medium transition-colors ${
                      gender === 'female' 
                        ? 'bg-royal-blue text-white' 
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    👩 Female
                  </button>
                </div>
              )}
              
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3 bg-royal-blue text-white rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : (isExistingUser ? 'Login' : 'Sign Up')}
              </button>
            </form>
            
            <button
              onClick={() => setStep('email')}
              className="w-full py-2 text-white/50 text-sm hover:text-white/70 transition-colors"
            >
              ← Back to email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthPage;
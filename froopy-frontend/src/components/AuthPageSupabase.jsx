import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContextSupabase';
import { supabase } from '../services/supabase';

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

function AuthPageSupabase() {
  const [step, setStep] = useState('email'); // 'email', 'password', or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState('');
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { setUser } = useUser();  
  const navigate = useNavigate();

  // Handle email submission and auto-detect user type
  const handleEmailContinue = async () => {
    if (isProcessing) return;
    
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email');
      return;
    }
    
    setIsProcessing(true);
    
    // Simplest solution: Default to signup flow, let error handling switch to login
    console.log('Starting with signup flow - will auto-switch to login if user exists');
    setIsExistingUser(false);
    setStep('signup');
    setIsProcessing(false);
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
    if (step === 'signup' && !gender) {
      alert('Please select your gender');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      if (step === 'password') {
        // Login existing user
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw signInError;
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (profileError) {
          console.error('Profile fetch error:', profileError);
          throw new Error('Failed to load user profile');
        }

        const userData = { 
          id: authData.user.id, 
          email: authData.user.email, 
          ...profile 
        };
        
        console.log('Login successful:', profile.username);
        setUser(userData);
        localStorage.setItem('supabase_user', JSON.stringify(userData));
        navigate('/');
        
      } else {
        // Sign up new user (step === 'signup')
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          throw signUpError;
        }

        if (!authData.user) {
          throw new Error('User creation failed');
        }

        // Create user profile immediately
        const username = generateUsername();
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            username,
            gender,
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          throw new Error('Failed to create user profile');
        }

        const userData = { 
          id: authData.user.id, 
          email: authData.user.email, 
          username, 
          gender 
        };
        
        console.log('Registration successful:', username);
        setUser(userData);
        localStorage.setItem('supabase_user', JSON.stringify(userData));
        navigate('/');
      }
    } catch (error) {
      console.error('Auth error:', error);
      let errorMessage = 'Authentication failed. Please try again.';
      
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error.message?.includes('User already registered') || error.message?.includes('already been registered')) {
        console.log('User already exists - switching to login mode');
        setIsExistingUser(true);
        setStep('password');
        errorMessage = 'This email is already registered. Please enter your password to sign in.';
        return; // Don't set processing to false, let user try again
      } else if (error.message?.includes('Too Many Requests') || error.status === 429) {
        errorMessage = 'Too many signup attempts. Please wait a moment and try again.';
      } else if (error.message?.includes('Failed to create user profile')) {
        errorMessage = 'Account created but profile setup failed. Please contact support.';
      }
      
      alert(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-navy flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-white text-3xl text-center mb-8">Froopy</h1>
        <p className="text-white/70 text-center mb-4 text-sm">
          {step === 'email' ? 'Enter your email to continue' : 
           step === 'password' ? 'Welcome back!' :
           'Create your account'} {step !== 'email' && '🚀'}
        </p>
        
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
        
        {(step === 'password' || step === 'signup') && (
          <div className="space-y-4">
            <div className="text-center mb-4">
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
                autoComplete={step === 'password' ? "current-password" : "new-password"}
              />
              
              {step === 'signup' && (
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
                {isProcessing ? 'Processing...' : (step === 'password' ? 'Login' : 'Sign Up')}
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

export default AuthPageSupabase;
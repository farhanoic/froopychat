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
  const [step, setStep] = useState('email'); // 'email' or 'auth'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState('');
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { setUser } = useUser();  
  const navigate = useNavigate();

  // Handle email submission and check if user exists
  const handleEmailContinue = async () => {
    if (isProcessing) return;
    
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Check if user exists by trying to get current session first
      const { data: session } = await supabase.auth.getSession();
      
      if (session?.user?.email === email) {
        // User is already logged in with this email
        setIsExistingUser(true);
      } else {
        // Try to sign in silently to check if user exists
        // This is a common pattern to check user existence
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: 'dummy' // We don't know the password yet
        });
        
        if (signInError) {
          if (signInError.message?.includes('Invalid login credentials')) {
            // Could be wrong password OR user doesn't exist
            // Let's assume new user for simplicity
            setIsExistingUser(false);
          } else {
            // User exists but password is wrong
            setIsExistingUser(true);
          }
        } else {
          // Successful sign in means user exists
          setIsExistingUser(true);
          // Sign out immediately since this was just a check
          await supabase.auth.signOut();
        }
      }
      
      setStep('auth');
      console.log(`Email ${email} ${isExistingUser ? 'exists' : 'is new'} - showing ${isExistingUser ? 'login' : 'signup'} flow`);
    } catch (error) {
      console.error('Email check error:', error);
      // Assume new user on error for better UX
      setIsExistingUser(false);
      setStep('auth');
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
        // Sign in existing user
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
        // Sign up new user
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

        // Create user profile
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
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and confirm your account before signing in.';
      } else if (error.message?.includes('User already registered')) {
        errorMessage = 'This email is already registered. Please sign in instead.';
        setIsExistingUser(true);
        return; // Don't set processing to false, let user try again
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
          {step === 'email' ? 'Enter your email to continue' : 'Powered by Supabase 🚀'}
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

export default AuthPageSupabase;
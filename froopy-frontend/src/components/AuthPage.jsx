import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

function AuthPage() {
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const { setUser } = useUser();
  const navigate = useNavigate();

  const handleContinue = () => {
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email');
      return;
    }
    
    const userData = { email, gender };
    setUser(userData);
    console.log('User data saved:', userData);
    navigate('/');
  };

  const handleGenderSelect = (selectedGender) => {
    if (!email || !email.includes('@')) {
      alert('Please enter your email first');
      return;
    }
    setGender(selectedGender);
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
        <button 
          onClick={handleContinue}
          className="bg-royal-blue text-white px-8 py-4 rounded-full hover:bg-blue-600 transition-colors"
        >
          Continue
        </button>
      )}
    </div>
  );
}

export default AuthPage;
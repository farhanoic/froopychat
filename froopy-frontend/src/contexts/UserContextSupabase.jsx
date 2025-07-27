import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Get user profile from our users table
          const { data: profile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (!error && profile) {
            const userData = {
              id: session.user.id,
              email: session.user.email,
              ...profile
            };
            setUser(userData);
            localStorage.setItem('supabase_user', JSON.stringify(userData));
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        if (event === 'SIGNED_IN' && session?.user) {
          // Get user profile
          const { data: profile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (!error && profile) {
            const userData = {
              id: session.user.id,
              email: session.user.email,
              ...profile
            };
            setUser(userData);
            localStorage.setItem('supabase_user', JSON.stringify(userData));
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          localStorage.removeItem('supabase_user');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      localStorage.removeItem('supabase_user');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };
  
  return (
    <UserContext.Provider value={{ 
      user, 
      setUser, 
      loading, 
      signOut 
    }}>
      {children}
    </UserContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
};
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isInitialLoad = true;

    // Check for existing session on mount
    const checkSession = async () => {
      try {
        console.log('Checking existing session...');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Session found:', !!session?.user, session?.user?.email);
        
        if (session?.user) {
          console.log('Loading user profile for session:', session.user.id);
          // Get user profile from our users table with timeout
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Session query timeout')), 5000)
          );
          
          const queryPromise = supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          const { data: profile, error } = await Promise.race([queryPromise, timeoutPromise]);

          console.log('Session profile query result:', { profile, error });

          if (!error && profile) {
            const userData = {
              id: session.user.id,
              email: session.user.email,
              ...profile
            };
            console.log('Setting user data from session:', userData);
            setUser(userData);
            localStorage.setItem('supabase_user', JSON.stringify(userData));
          } else {
            console.error('Session profile not found or error:', error);
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        console.log('Session check complete, setting loading to false');
        setLoading(false);
        isInitialLoad = false;
      }
    };

    checkSession();

    // Listen for auth changes - skip SIGNED_IN during initial load
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        // Skip SIGNED_IN during initial load since checkSession handles it more reliably
        if (event === 'SIGNED_IN' && session?.user && !isInitialLoad) {
          try {
            console.log('Loading user profile for:', session.user.id);
            // Get user profile with explicit timeout
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Query timeout')), 5000)
            );
            
            const queryPromise = supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            const { data: profile, error } = await Promise.race([queryPromise, timeoutPromise]);

            console.log('Profile query result:', { profile, error });

            if (!error && profile) {
              const userData = {
                id: session.user.id,
                email: session.user.email,
                ...profile
              };
              console.log('Setting user data:', userData);
              setUser(userData);
              localStorage.setItem('supabase_user', JSON.stringify(userData));
            } else {
              console.error('Profile not found or error:', error);
            }
          } catch (error) {
            console.error('Error loading user profile on auth change:', error);
          } finally {
            console.log('Setting loading to false');
            setLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          localStorage.removeItem('supabase_user');
          setLoading(false);
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
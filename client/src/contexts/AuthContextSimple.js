// Dynamic API URL - works for both local and production
const API_BASE_URL = process.env.NODE_ENV === "production" ? "" : "http://localhost:5000";
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      
      if (token && userData) {
        // Verify token is still valid by checking profile
        const response = await fetch('${API_BASE_URL}/api/auth/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const user = await response.json();
          setUser(user);
        } else {
          // Token is invalid, clear storage
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  };

  const login = (userData) => {
    console.log('Login called with user data:', userData);
    setUser(userData);
    setLoading(false);
    setIsInitialized(true);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const isAuthenticated = () => {
    return !!localStorage.getItem('token') && !!user;
  };

  const value = {
    user,
    loading: loading || !isInitialized,
    login,
    logout,
    checkAuth,
    getAuthHeaders,
    isAuthenticated
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('kickloyalty_token');
    const savedUser = localStorage.getItem('kickloyalty_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      // Set default auth header
      axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
    }

    setLoading(false);
  }, []);

  const login = async (username) => {
    try {
      setError(null);
      setLoading(true);

      const response = await axios.post('/api/auth/login', { username });

      const { token: newToken, user: userData } = response.data;

      setToken(newToken);
      setUser(userData);

      localStorage.setItem('kickloyalty_token', newToken);
      localStorage.setItem('kickloyalty_user', JSON.stringify(userData));

      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

      return userData;
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Login fallito';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const loginWithKick = async (code, state) => {
    try {
      setError(null);
      setLoading(true);

      const response = await axios.post('/api/auth/kick/callback', { code, state });

      const { token: newToken, user: userData } = response.data;

      setToken(newToken);
      setUser(userData);

      localStorage.setItem('kickloyalty_token', newToken);
      localStorage.setItem('kickloyalty_user', JSON.stringify(userData));

      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

      return userData;
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Kick login fallito';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('kickloyalty_token');
    localStorage.removeItem('kickloyalty_user');
    delete axios.defaults.headers.common['Authorization'];
  };

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        isAuthenticated,
        login,
        loginWithKick,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

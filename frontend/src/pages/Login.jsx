import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, Zap } from 'lucide-react';
import TwoFactorVerify from '../components/TwoFactorVerify';

const Login = () => {
  const navigate = useNavigate();
  const { login, loginWithKick, loading, error } = useAuth();
  const [username, setUsername] = useState('');
  const [localError, setLocalError] = useState('');
  const [requiresTwoFa, setRequiresTwoFa] = useState(false);
  const [tempAuthToken, setTempAuthToken] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setLocalError('Inserisci uno username');
      return;
    }

    try {
      // Try to login first
      await login(username);
      
      // Check if 2FA is required (this would need backend support)
      // For now, just navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      // If error indicates 2FA required, show 2FA modal
      if (err.message && err.message.includes('2FA')) {
        setRequiresTwoFa(true);
        // In a real implementation, backend would return a temp token
        // setTempAuthToken(err.tempToken);
      } else {
        setLocalError(err.message);
      }
    }
  };

  const handleTwoFaVerified = async (twoFaData) => {
    try {
      // In a real implementation, the 2FA verification would have been done
      // and we'd receive the final authentication token
      setRequiresTwoFa(false);
      navigate('/dashboard');
    } catch (err) {
      setLocalError('Failed to complete 2FA verification');
    }
  };

  const handleKickLogin = async () => {
    try {
      // Get Kick OAuth URL
      const response = await fetch('/api/auth/kick/url');
      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setLocalError('Errore accesso Kick');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-brand-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
      </div>

      {/* Container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-brand-600 text-black font-bold text-2xl mb-4 animate-glow">
            K
          </div>
          <h1 className="text-3xl font-bold text-text mb-2">Kick Loyalty</h1>
          <p className="text-text-muted">Gestisci rewards e loyalty per i tuoi stream</p>
        </div>

        {/* Card */}
        <div className="card p-6 space-y-6 mb-4">
          {/* Error Message */}
          {(error || localError) && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error || localError}
            </div>
          )}

          {/* Simple Login */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text mb-2 block">
                Username Kick
              </label>
              <input
                type="text"
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  setLocalError('');
                }}
                placeholder="Es: streamer_pro"
                className="input-base w-full"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="button-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? 'Caricamento...' : 'Accedi'}
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-surface-1 text-text-muted">oppure</span>
            </div>
          </div>

          {/* Kick OAuth */}
          <button
            type="button"
            onClick={handleKickLogin}
            disabled={loading}
            className="button-secondary w-full flex items-center justify-center gap-2"
          >
            <Zap size={16} />
            {loading ? 'Caricamento...' : 'Accedi con Kick'}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-text-muted">
          Per la prima volta? Crea un account accedendo con il tuo username Kick.
        </p>
      </div>

      {/* 2FA Verification Modal */}
      {requiresTwoFa && (
        <TwoFactorVerify
          onVerifySuccess={handleTwoFaVerified}
          onCancel={() => {
            setRequiresTwoFa(false);
            setLocalError('');
          }}
        />
      )}
    </div>
  );
};

export default Login;

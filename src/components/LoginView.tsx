import React, { useState } from 'react';
import { Layers, Mail, Lock, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface LoginViewProps {
  onLoginSuccess: (user: any) => void;
  onNavigateToRegister: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onNavigateToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.auth.login(email, password);
      onLoginSuccess(response.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-tv-accent selection:text-tv-base"
      style={{
        background: 'radial-gradient(ellipse 90% 60% at 15% 0%, rgba(39,26,88,0.75) 0%, transparent 58%), radial-gradient(ellipse 70% 50% at 90% 100%, rgba(39,26,88,0.55) 0%, transparent 52%), #0E0B1A',
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
      }}
    >
      {/* Ambient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(160,137,230,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(39,26,88,0.4) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #A089E6 0%, #271A58 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 32px rgba(160,137,230,0.35), 0 4px 16px rgba(0,0,0,0.4)',
          }}>
            <Layers style={{ width: '26px', height: '26px', color: '#FFFFFF' }} />
          </div>
        </div>
        <h1 style={{ marginTop: '20px', textAlign: 'center', fontSize: '28px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.03em' }}>
          Jeevan Infotech AI
        </h1>
        <p style={{ marginTop: '6px', textAlign: 'center', fontSize: '13px', color: '#B8B0D4', fontWeight: 500 }}>
          Sign in to your account
        </p>
        <p style={{ marginTop: '4px', textAlign: 'center', fontSize: '13px', color: '#6E6594' }}>
          Or{' '}
          <button
            onClick={onNavigateToRegister}
            style={{ color: '#A089E6', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#B8A4EE')}
            onMouseLeave={e => (e.currentTarget.style.color = '#A089E6')}
          >
            create a new Owner account
          </button>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div style={{
          background: 'rgba(22, 15, 53, 0.72)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(160, 137, 230, 0.18)',
          borderRadius: '20px',
          padding: '36px 40px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(160,137,230,0.08) inset',
        }}>
          <form className="space-y-5" onSubmit={handleLogin}>
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.10)', borderLeft: '3px solid #F87171', padding: '12px 16px', borderRadius: '0 10px 10px 0', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertCircle style={{ width: '16px', height: '16px', color: '#F87171', flexShrink: 0, marginTop: '1px' }} />
                <p style={{ fontSize: '13px', color: '#FCA5A5', margin: 0 }}>{error}</p>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#B8B0D4', marginBottom: '6px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Email address
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', inset: '0 auto 0 0', paddingLeft: '13px', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <Mail style={{ height: '16px', width: '16px', color: '#6E6594' }} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@company.com"
                  style={{
                    width: '100%', paddingLeft: '40px', paddingRight: '14px', paddingTop: '11px', paddingBottom: '11px',
                    background: 'rgba(14, 11, 26, 0.6)', border: '1px solid rgba(160,137,230,0.18)',
                    borderRadius: '12px', fontSize: '14px', color: '#FFFFFF', outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(160,137,230,0.55)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,137,230,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(160,137,230,0.18)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#B8B0D4', marginBottom: '6px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', inset: '0 auto 0 0', paddingLeft: '13px', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <Lock style={{ height: '16px', width: '16px', color: '#6E6594' }} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', paddingLeft: '40px', paddingRight: '14px', paddingTop: '11px', paddingBottom: '11px',
                    background: 'rgba(14, 11, 26, 0.6)', border: '1px solid rgba(160,137,230,0.18)',
                    borderRadius: '12px', fontSize: '14px', color: '#FFFFFF', outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(160,137,230,0.55)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,137,230,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(160,137,230,0.18)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            <div style={{ paddingTop: '4px' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                  padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                  color: '#FFFFFF', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading ? 'rgba(160,137,230,0.35)' : 'linear-gradient(135deg, #A089E6 0%, #7B5CC8 100%)',
                  boxShadow: loading ? 'none' : '0 4px 24px rgba(160,137,230,0.35)',
                  transition: 'all 0.2s', fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
                  letterSpacing: '0.01em',
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'linear-gradient(135deg, #B8A4EE 0%, #9070D8 100%)'; e.currentTarget.style.boxShadow = '0 6px 30px rgba(160,137,230,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = 'linear-gradient(135deg, #A089E6 0%, #7B5CC8 100%)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(160,137,230,0.35)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
              >
                {loading ? (
                  <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <>Sign In <ArrowRight style={{ width: '16px', height: '16px' }} /></>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Layers, Mail, Lock, User as UserIcon, Building2, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface RegisterViewProps {
  onRegisterSuccess: (user: any) => void;
  onNavigateToLogin: () => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({ onRegisterSuccess, onNavigateToLogin }) => {
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.auth.register({
        full_name: fullName,
        company_name: companyName,
        email,
        password,
        confirm_password: confirmPassword
      });
      onRegisterSuccess(response.user);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', paddingLeft: '40px', paddingRight: '14px', paddingTop: '11px', paddingBottom: '11px',
    background: 'rgba(14, 11, 26, 0.6)', border: '1px solid rgba(160,137,230,0.18)',
    borderRadius: '12px', fontSize: '14px', color: '#FFFFFF', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s', fontFamily: 'inherit',
  };
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(160,137,230,0.55)';
    e.target.style.boxShadow = '0 0 0 3px rgba(160,137,230,0.12)';
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(160,137,230,0.18)';
    e.target.style.boxShadow = 'none';
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600, color: '#B8B0D4',
    marginBottom: '6px', letterSpacing: '0.04em', textTransform: 'uppercase',
  };
  const iconWrap: React.CSSProperties = {
    position: 'absolute', inset: '0 auto 0 0', paddingLeft: '13px',
    display: 'flex', alignItems: 'center', pointerEvents: 'none',
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
          Create an Account
        </h1>
        <p style={{ marginTop: '6px', textAlign: 'center', fontSize: '13px', color: '#B8B0D4', fontWeight: 500 }}>
          Register your company on Jeevan Infotech AI
        </p>
        <p style={{ marginTop: '4px', textAlign: 'center', fontSize: '13px', color: '#6E6594' }}>
          Already have an account?{' '}
          <button
            onClick={onNavigateToLogin}
            style={{ color: '#A089E6', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#B8A4EE')}
            onMouseLeave={e => (e.currentTarget.style.color = '#A089E6')}
          >
            Sign in
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
          <form className="space-y-4" onSubmit={handleRegister}>
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.10)', borderLeft: '3px solid #F87171', padding: '12px 16px', borderRadius: '0 10px 10px 0', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertCircle style={{ width: '16px', height: '16px', color: '#F87171', flexShrink: 0, marginTop: '1px' }} />
                <p style={{ fontSize: '13px', color: '#FCA5A5', margin: 0 }}>{error}</p>
              </div>
            )}

            <div>
              <label style={labelStyle}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <div style={iconWrap}><UserIcon style={{ height: '16px', width: '16px', color: '#6E6594' }} /></div>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Company Name</label>
              <div style={{ position: 'relative' }}>
                <div style={iconWrap}><Building2 style={{ height: '16px', width: '16px', color: '#6E6594' }} /></div>
                <input type="text" required value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Textiles" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Email address</label>
              <div style={{ position: 'relative' }}>
                <div style={iconWrap}><Mail style={{ height: '16px', width: '16px', color: '#6E6594' }} /></div>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="john@acmetextiles.com" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <div style={iconWrap}><Lock style={{ height: '16px', width: '16px', color: '#6E6594' }} /></div>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <div style={iconWrap}><Lock style={{ height: '16px', width: '16px', color: '#6E6594' }} /></div>
                <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>
            </div>

            <div style={{ paddingTop: '8px' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                  padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                  color: '#FFFFFF', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading ? 'rgba(160,137,230,0.35)' : 'linear-gradient(135deg, #A089E6 0%, #7B5CC8 100%)',
                  boxShadow: loading ? 'none' : '0 4px 24px rgba(160,137,230,0.35)',
                  transition: 'all 0.2s', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, letterSpacing: '0.01em',
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'linear-gradient(135deg, #B8A4EE 0%, #9070D8 100%)'; e.currentTarget.style.boxShadow = '0 6px 30px rgba(160,137,230,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = 'linear-gradient(135deg, #A089E6 0%, #7B5CC8 100%)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(160,137,230,0.35)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
              >
                {loading ? (
                  <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <>Create Account <ArrowRight style={{ width: '16px', height: '16px' }} /></>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

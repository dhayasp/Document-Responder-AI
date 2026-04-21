'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Using Supabase auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/verify`,
      }
    });

    if (error) {
      setError(error.message);
    } else {
      if (data.session) {
        router.push('/dashboard');
      } else {
        setError('Signup successful! 🚀 Please check your inbox and verify your email to log in.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2 style={{ color: 'var(--color-neon-yellow)', marginBottom: '20px', textAlign: 'center' }}>Create Account</h2>
        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Email</label>
            <input 
              type="email" 
              className="input-base" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Password</label>
            <input 
              type="password" 
              className="input-base" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p style={{ color: error.includes('successful') ? 'var(--color-neon-yellow)' : 'var(--color-red)', fontSize: '0.9rem', lineHeight: '1.4' }}>{error}</p>}
          <button 
            type="submit" 
            disabled={loading} 
            style={{ 
              marginTop: '15px',
              background: loading ? 'var(--color-medium-grey)' : 'var(--color-neon-yellow)',
              color: loading ? 'var(--text-secondary)' : 'var(--bg-color)',
              border: 'none',
              padding: '14px 24px',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '1.1rem',
              cursor: loading ? 'default' : 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: loading ? 'none' : '0 0 20px rgba(253, 224, 71, 0.5), 0 0 40px rgba(253, 224, 71, 0.2)',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '10px',
              transform: loading ? 'scale(1)' : 'scale(1.02)'
            }}
            onMouseOver={(e: any) => { if(!loading) { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 0 30px rgba(253, 224, 71, 0.8), 0 0 60px rgba(253, 224, 71, 0.4)'; } }}
            onMouseOut={(e: any) => { if(!loading) { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(253, 224, 71, 0.5), 0 0 40px rgba(253, 224, 71, 0.2)'; } }}
          >
            {loading ? 'Creating...' : 'Sign Up ⚡'}
          </button>
        </form>
        <p style={{ marginTop: '25px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Already have an account? <Link href="/login" style={{ color: 'var(--color-neon-yellow)', fontWeight: 600 }}>Login here</Link>
        </p>
      </div>
    </div>
  );
}

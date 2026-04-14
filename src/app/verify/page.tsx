'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function Verify() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkVerification = async () => {
      // Check if there is an active session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsAuthenticated(true);
      } else {
        // Sometimes Supabase might take a moment to establish the session right after redirect
        // We can listen to the auth state change
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session) {
            setIsAuthenticated(true);
          }
        });
        
        // Timeout to stop loading state if no auth state change happens
        setTimeout(() => {
          if (!session) {
            setLoading(false);
          }
        }, 3000);

        return () => subscription.unsubscribe();
      }
      setLoading(false);
    };

    checkVerification();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--color-dark-grey)', padding: '40px', borderRadius: '12px', width: '100%', maxWidth: '500px', border: '1px solid var(--color-medium-grey)', textAlign: 'center' }}>
        {loading && !isAuthenticated ? (
          <div>
            <h2 style={{ color: 'var(--color-neon-yellow)', marginBottom: '20px' }}>Verifying Authentication...</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Please wait while we confirm your email verification.</p>
          </div>
        ) : (
          <div>
            <h2 style={{ color: 'var(--color-neon-yellow)', marginBottom: '20px' }}>Email Verified Successfully! 🚀</h2>
            <div style={{ marginBottom: '30px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '15px' }}>
                Your email has been successfully authenticated. Welcome to Document Responder AI!
              </p>
              <p>
                You now have full access to our intelligent AI capabilities. To get started, please continue to your dashboard.
              </p>
            </div>
            <Link 
              href="/dashboard"
              style={{
                display: 'inline-block',
                background: 'var(--color-neon-yellow)',
                color: 'var(--bg-color)',
                textDecoration: 'none',
                padding: '14px 24px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '1.1rem',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 20px rgba(253, 224, 71, 0.5), 0 0 40px rgba(253, 224, 71, 0.2)',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
              }}
            >
              Go to Dashboard ⚡
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

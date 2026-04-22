'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import ChatInterface from '@/components/ChatInterface';

function DashboardContent() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setUser(session.user);
      }
    };
    checkUser();
  }, [router]);

  if (!user) {
    return <div style={{ color: 'var(--color-neon-yellow)', padding: '2rem', textAlign: 'center' }}>Loading dashboard...</div>;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <header style={{ 
        padding: '1rem 2rem', 
        borderBottom: '1px solid var(--color-medium-grey)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(23, 23, 23, 0.8)',
        backdropFilter: 'blur(10px)'
      }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 800 }}>
          <span style={{ color: 'var(--color-neon-yellow)' }}>Tiger</span> AI
        </h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{user.email}</span>
          <button 
            onClick={handleLogout} 
            style={{ 
              padding: '8px 20px', 
              fontSize: '0.9rem', 
              borderRadius: '8px',
              border: 'none',
              background: 'var(--color-neon-yellow)',
              color: 'var(--bg-color)',
              fontWeight: 800,
              boxShadow: '0 0 15px rgba(240, 88, 88, 0.4)',
              transition: 'all 0.3s',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseOver={(e: any) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 0 25px rgba(239, 68, 68, 0.7)'; }}
            onMouseOut={(e: any) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.4)'; }}
          >
            Logout 👋
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Unified Interface */}
        <div className="dashboard-right-content">
           <ChatInterface />
        </div>
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--color-neon-yellow)', padding: '2rem', textAlign: 'center' }}>Loading collaborative session...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

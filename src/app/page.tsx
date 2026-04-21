'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './page.module.css';

export default function Home() {
  const [displayText, setDisplayText] = useState('');
  const fullText = "Tiger Doc Res AI";

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setDisplayText(fullText.slice(0, index));
      index++;
      if (index > fullText.length) {
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.main}>
      {/* Animated Background */}
      <div className={styles.background}>
        <div className={styles.particle1}></div>
        <div className={styles.particle2}></div>
        <div className={styles.particle3}></div>
      </div>

      <div className={styles.content}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className={styles.header}
        >
          <div className={styles.badge}>PRODUCTION RAG AGENT</div>
          <h1 className={styles.title}>
            {displayText}
            <span className={styles.cursor}>|</span>
          </h1>
          <p className={styles.subtitle}>
            One place to upload, search, and understand all your documents with Tiger AI
          </p>

          <div className={styles.actions}>
            <Link href="/signup" className={styles.linkWrapper}>
              <button className={styles.primaryButton}>
                Get Started ⚡
              </button>
            </Link>
            <Link href="/login" className={styles.linkWrapper}>
              <button className={styles.secondaryButton}>
                Login 🚀
              </button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className={styles.features}
        >
          <div className={styles.featureCard}>
            <h3>🧠 Intelligent RAG</h3>
            <p>Powered by vector search to provide answers solely based on your provided documents.</p>
          </div>
          <div className={styles.featureCard}>
            <h3>🎙️ Voice Output & Input</h3>
            <p>Use Web Speech API to interact with the AI hands-free. Real-time TTS response.</p>
          </div>
          <div className={styles.featureCard}>
            <h3>🌐 Search Integration</h3>
            <p>Cross-reference AI responses with live Google searches natively.</p>
          </div>
          <div className={styles.featureCard}>
            <h3>🧠 Persistent Chat Memory</h3>
            <p>Securely stores conversations in Supabase for seamless continuity.</p>
          </div>

          <div className={styles.featureCard}>
            <h3>📝 Study Guide Generator</h3>
            <p>Export structured answers into clean, printable PDF study materials.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

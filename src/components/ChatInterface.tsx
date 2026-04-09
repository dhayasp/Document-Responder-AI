'use client';

import { useState, useRef, useEffect } from 'react';
import { PaperPlaneRight, Microphone, SpeakerHigh, StopCircle, MagnifyingGlass, CheckCircle, Robot, DownloadSimple } from '@phosphor-icons/react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/lib/supabase';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  confidence?: number;
  generatedBy?: string;
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'short' | 'long'>('short');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Setup Web Speech API for voice input
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + ' ' + transcript);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    // Load Chat Memory from Supabase
    const loadMemory = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data, error } = await supabase
          .from('chat_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });
          
        if (data && data.length > 0) {
          setMessages(data.map((d: any) => ({
            id: d.id,
            role: d.role,
            content: d.content,
          })));
        }
      }
    };
    loadMemory();
  }, []);

  const saveToHistory = async (role: 'user' | 'assistant', content: string) => {
    if (!userId) return;
    await supabase.from('chat_history').insert({ user_id: userId, role, content });
  };

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const openGoogleSearch = (query: string) => {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
  };

  const exportPDF = (content: string, id: string) => {
    import('html2pdf.js').then((html2pdf) => {
      const element = document.getElementById(`msg-${id}`);
      if (element) {
        const cloned = element.cloneNode(true) as HTMLElement;
        cloned.style.background = '#171717';
        cloned.style.padding = '20px';
        cloned.style.color = '#ffffff';
        
        const opt = {
          margin:       0.5,
          filename:     `Tiger-Study-Guide-${Date.now()}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#171717' },
          jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        html2pdf.default().set(opt).from(cloned).save();
      }
    });
  };

  const processStream = async (queryToProcess: string, apiMode: string) => {
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: queryToProcess };
    setMessages(prev => [...prev, userMessage]);
    saveToHistory('user', queryToProcess);
    
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryToProcess, mode: apiMode })
      });

      if (!res.ok) throw new Error('API Request Failed');
      
      const sourcesHeader = res.headers.get('X-Sources');
      const confidenceHeader = res.headers.get('X-Confidence');
      const generatedByHeader = res.headers.get('X-Generated-By');
      
      const sources = sourcesHeader ? JSON.parse(decodeURIComponent(sourcesHeader)) : [];
      const confidence = confidenceHeader ? parseFloat(confidenceHeader) : 0;
      const generatedBy = generatedByHeader || 'Unknown';

      const assistantId = (Date.now() + 1).toString();
      let assistantContent = "";
      
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: "...",
        sources,
        confidence,
        generatedBy
      }]);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No readable stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (line.trim() === '' || line.includes('[DONE]')) continue;
          if (line.startsWith('data:')) {
            try {
              const dataStr = line.substring(5).trim();
              if (dataStr === '[DONE]') continue;
              const parsed = JSON.parse(dataStr);
              if (parsed.choices?.[0]?.delta?.content) {
                if (assistantContent === "...") assistantContent = "";
                assistantContent += parsed.choices[0].delta.content;
                setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m));
              }
            } catch (e) { /* ignore partial JSON */ }
          }
        }
      }
      saveToHistory('assistant', assistantContent);
    } catch (error: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `Error: ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;
    const currentInput = input;
    setInput('');
    await processStream(currentInput, mode);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid var(--color-medium-grey)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-color)' }}>
      {/* Header Settings */}
      <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--color-medium-grey)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(23, 23, 23, 0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-neon-yellow)' }}>
          <Robot size={24} />
          <span style={{ fontWeight: 600 }}>Tiger AI Engine</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', background: 'var(--bg-color)', padding: '4px', borderRadius: '8px', border: '1px solid var(--color-medium-grey)' }}>
          <button 
            onClick={() => setMode('short')} 
            style={{ 
              background: mode === 'short' ? 'var(--color-dark-grey)' : 'transparent',
              color: mode === 'short' ? 'var(--color-neon-yellow)' : 'var(--text-secondary)',
              border: mode === 'short' ? '1px solid var(--color-neon-yellow)' : '1px solid transparent',
              padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            Short Mode
          </button>
          <button 
            onClick={() => setMode('long')} 
            style={{ 
              background: mode === 'long' ? 'var(--color-dark-grey)' : 'transparent',
              color: mode === 'long' ? 'var(--color-neon-yellow)' : 'var(--text-secondary)',
              border: mode === 'long' ? '1px solid var(--color-neon-yellow)' : '1px solid transparent',
              padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            Long Mode
          </button>
        </div>
      </div>

      {/* Messages Window */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: '10px' }}>Ask me anything about your uploaded documents.</p>
            <p style={{ fontSize: '0.85rem' }}>E.g. "What is the main topic?" or "Explain the summary."</p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
            {msg.role === 'assistant' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                 <Robot size={18} color="var(--color-neon-yellow)" />
                 {msg.generatedBy && (
                   <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--color-medium-grey)' }}>
                     {msg.generatedBy.includes('Groq') ? '🦙' : '🧠'} Generated by {msg.generatedBy}
                   </span>
                 )}
                 {msg.confidence !== undefined && msg.confidence > 0 && (
                   <span style={{ fontSize: '0.75rem', color: msg.confidence > 0.7 ? 'var(--color-neon-yellow)' : 'var(--color-red)', background: 'var(--color-dark-grey)', padding: '2px 6px', borderRadius: '4px' }}>
                     {Math.round(msg.confidence * 100)}% Confidence
                   </span>
                 )}
              </div>
            )}
            
            <div id={`msg-${msg.id}`} style={{ 
              background: msg.role === 'user' ? 'var(--color-dark-grey)' : 'rgba(253, 224, 71, 0.05)', 
              border: msg.role === 'user' ? '1px solid var(--color-medium-grey)' : '1px solid rgba(253, 224, 71, 0.3)',
              padding: '16px', 
              borderRadius: '12px',
              borderBottomRightRadius: msg.role === 'user' ? '4px' : '12px',
              borderTopLeftRadius: msg.role === 'assistant' ? '4px' : '12px',
              color: 'var(--text-primary)',
              lineHeight: '1.6'
            }}>
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  components={{
                    h1: ({node, ...props}) => <h1 style={{color: 'var(--color-neon-yellow)', marginTop: '12px', marginBottom: '8px', fontSize: '1.4rem'}} {...props} />,
                    h2: ({node, ...props}) => <h2 style={{color: 'var(--color-neon-yellow)', marginTop: '12px', marginBottom: '8px', fontSize: '1.2rem'}} {...props} />,
                    h3: ({node, ...props}) => <h3 style={{color: 'var(--text-primary)', marginTop: '10px', marginBottom: '6px', fontSize: '1.1rem'}} {...props} />,
                    p: ({node, ...props}) => <p style={{marginBottom: '12px', lineHeight: '1.8'}} {...props} />,
                    ul: ({node, ...props}) => <ul style={{marginBottom: '12px', paddingLeft: '24px'}} {...props} />,
                    ol: ({node, ...props}) => <ol style={{marginBottom: '12px', paddingLeft: '24px'}} {...props} />,
                    li: ({node, ...props}) => <li style={{marginBottom: '6px', lineHeight: '1.6'}} {...props} />,
                    strong: ({node, ...props}) => <strong style={{color: 'var(--color-neon-yellow)', fontWeight: 600}} {...props} />,
                    code: ({node, ...props}) => <code style={{background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', color: '#ff7b72'}} {...props} />
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
            
            {msg.role === 'assistant' && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button onClick={() => speak(msg.content)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'transparent', border: '1px solid var(--color-medium-grey)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    <SpeakerHigh size={14} /> Read Aloud
                  </button>
                  <button onClick={() => {
                        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                        if (lastUserMsg) openGoogleSearch(lastUserMsg.content);
                    }} 
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'transparent', border: '1px solid var(--color-neon-yellow)', color: 'var(--color-neon-yellow)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    <MagnifyingGlass size={14} /> Search on Google
                  </button>
                  <button onClick={() => exportPDF(msg.content, msg.id!)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--color-neon-yellow)', border: '1px solid var(--color-neon-yellow)', color: 'var(--bg-color)', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                    <DownloadSimple size={14} weight="bold" /> Download Study Guide
                  </button>
                </div>
                
                {msg.sources && msg.sources.length > 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-color)', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-medium-grey)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Sources:</span>
                    {msg.sources.map((src, i) => (
                      <div key={i} style={{ marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <CheckCircle size={12} color="var(--color-neon-yellow)" style={{ marginRight: '4px', verticalAlign: 'middle' }}/>
                        {src}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-neon-yellow)' }}>
            <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(253, 224, 71, 0.3)', borderTopColor: 'var(--color-neon-yellow)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <span style={{ fontSize: '0.9rem' }}>Tiger is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ padding: '20px', borderTop: '1px solid var(--color-medium-grey)', background: 'var(--color-dark-grey)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
          <button 
            type="button" 
            onClick={toggleListen}
            style={{ 
              background: isListening ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-color)', 
              border: isListening ? '1px solid var(--color-red)' : '1px solid var(--color-medium-grey)',
              padding: '12px', borderRadius: '8px', cursor: 'pointer',
              color: isListening ? 'var(--color-red)' : 'var(--text-secondary)',
              transition: 'all 0.3s'
            }}
            title="Voice Input"
          >
            {isListening ? <StopCircle size={22} weight="fill" className="animate-pulse" /> : <Microphone size={22} />}
          </button>
          
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Tiger AI..."
            style={{ flex: 1, background: 'var(--bg-color)', border: '1px solid var(--color-medium-grey)', color: 'white', padding: '12px 16px', borderRadius: '8px', outline: 'none' }}
          />
          
          <button 
            type="submit" 
            disabled={!input.trim() || loading}
            style={{ 
              background: input.trim() && !loading ? 'var(--color-neon-yellow)' : 'var(--color-medium-grey)', 
              border: 'none',
              padding: '12px 20px', borderRadius: '8px', cursor: input.trim() ? 'pointer' : 'default',
              color: input.trim() && !loading ? 'var(--bg-color)' : 'var(--text-secondary)',
              fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            Send <PaperPlaneRight size={18} weight="bold" />
          </button>
        </form>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
      `}</style>
    </div>
  );
}

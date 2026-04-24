'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PaperPlaneRight, Microphone, SpeakerHigh, StopCircle, MagnifyingGlass, CheckCircle, Robot, DownloadSimple, PlusCircle, ChatCircleText, UsersThree, Copy, Link as LinkIcon, Trash, SignOut, WarningCircle, List, X } from '@phosphor-icons/react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/lib/supabase';
import Uploader from '@/components/Uploader';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  confidence?: number;
  generatedBy?: string;
  user_id?: string; // Track who sent it in collab mode
};

type Session = {
  id: string;
  title: string;
  isCollab?: boolean;
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mode, setMode] = useState<'short' | 'long'>('short');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [roomOwnerId, setRoomOwnerId] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState<number>(1);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const typingTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const activeChannelRef = useRef<any>(null);
  
  const searchParams = useSearchParams();
  const roomParam = searchParams.get('room');
  const router = useRouter();
  const hasMounted = useRef(false);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Voice setup & initial Memory load
  useEffect(() => {
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

    const initData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
         if (roomParam?.startsWith('collab-')) {
            alert("You must be logged in to join a Shared Collaborative Room!");
            router.replace('/signin');
         }
         return;
      }
      setUserId(user.id);
      
      console.log("[Collab Debug] Initializing Workspace for User:", user.id);
      
      // Load distinct sessions for sidebar
      const { data: collabMembers } = await supabase.from('collab_members').select('room_id').eq('user_id', user.id);
      const activeCollabIds = new Set(collabMembers?.map(c => c.room_id) || []);

      const { data } = await supabase
        .from('chat_history')
        .select('session_id, session_title')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      const uniqueSessions: Session[] = [];
      if (data && data.length > 0) {
        const seen = new Set();
        for (const row of data) {
          const sid = row.session_id || 'legacy-chat';
          const stitle = row.session_title || 'Old Conversation';
          
          if (sid.startsWith('collab-') && !activeCollabIds.has(sid)) {
            continue;
          }

          if (!seen.has(sid)) {
            seen.add(sid);
            uniqueSessions.push({ id: sid, title: stitle, isCollab: sid.startsWith('collab-') });
          }
        }
        setSessions(uniqueSessions);
      }
      
      if (roomParam) {
         console.log("[Collab Debug] Joining specific room:", roomParam);
         // Auto-add to sidebar if it's a shared room they are joining fresh
         if (!uniqueSessions.find(s => s.id === roomParam)) {
            const isCollab = roomParam.startsWith('collab-');
            const placeholderSession = { id: roomParam, title: isCollab ? 'Shared Room' : 'Private Room', isCollab };
            setSessions(prev => [placeholderSession, ...prev]);
         }
         loadMessages(roomParam, user.id);
         
         if (roomParam.startsWith('collab-')) {
            const { data: roomData, error: roomError } = await supabase.from('collab_rooms').select('owner_id').eq('id', roomParam).single();
            if (roomError) console.error("[Collab Debug] Could not fetch Room Owner Details:", roomError);
            if (roomData) {
               console.log("[Collab Debug] Target Room Owner mapped correctly to:", roomData.owner_id);
               setRoomOwnerId(roomData.owner_id);
               const { error: upsertErr } = await supabase.from('collab_members').upsert({ room_id: roomParam, user_id: user.id });
               if (upsertErr) console.error("[Collab Debug] Upsert Members Error:", upsertErr);
               
               const { count } = await supabase.from('collab_members').select('*', { count: 'exact', head: true }).eq('room_id', roomParam);
               setParticipantCount(count || 1);
            }
         }
      } else if (uniqueSessions.length > 0) {
        // Auto-load most recent session if exists
        loadMessages(uniqueSessions[0].id, user.id);
      } else {
        // No history, start brand new
        startNewPrivateConversation();
      }
    };

    if (!hasMounted.current) {
      hasMounted.current = true;
      initData();
    } else if (roomParam && roomParam !== activeSessionId) {
      initData();
    }
  }, [roomParam]);


  // 🔥 Supabase Realtime Listener setup
  useEffect(() => {
    if (!activeSessionId) return;

    // --- 1. Global Document Upload Listener ---
    const globalChannel = supabase
      .channel('global_notifications')
      .on('broadcast', { event: 'document_uploaded' }, (payload) => {
         // Auto-inject a system message to everyone
         setMessages(prev => [...prev, {
            id: `sys-${Date.now()}`,
            role: 'assistant',
            content: `**System Alert**: A peer just uploaded _${payload.payload.filename}_! The vector database has been updated and I am ready to answer questions about it.`
         }]);
      })
      .on('broadcast', { event: 'document_deleted' }, (payload) => {
         // Auto-inject a system message indicating deletion
         setMessages(prev => [...prev, {
            id: `sys-del-${Date.now()}`,
            role: 'assistant',
            content: `**System Alert**: A peer has completely deleted _${payload.payload.filename}_ from the active memory. I can no longer answer questions regarding its specific contents.`
         }]);
      })
      .subscribe();

    // Only set up Collab Realtime for collab rooms
    if (!activeSessionId.startsWith('collab-')) {
       return () => { supabase.removeChannel(globalChannel); };
    }
    
    // --- 2. Room Specific Listener ---
    const channel = supabase
      .channel(`room:${activeSessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_history', filter: `session_id=eq.${activeSessionId}` },
        (payload) => {
          if (payload.new.user_id !== userId) {
            setMessages(prev => {
              if (prev.find(m => m.id === payload.new.id?.toString() || m.content === payload.new.content)) return prev;
              
              return [...prev, {
                id: payload.new.id?.toString() || Date.now().toString(),
                role: payload.new.role,
                content: payload.new.content,
                user_id: payload.new.user_id
              }];
            });
          }
        }
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        const typingUserId = payload.payload.user_id;
        if (typingUserId !== userId) {
            setTypingUsers(prev => {
               if (!prev.includes(typingUserId)) {
                  return [...prev, typingUserId];
               }
               return prev;
            });
            
            if (typingTimeoutsRef.current[typingUserId]) {
                clearTimeout(typingTimeoutsRef.current[typingUserId]);
            }
            typingTimeoutsRef.current[typingUserId] = setTimeout(() => {
               setTypingUsers(prev => prev.filter(id => id !== typingUserId));
               delete typingTimeoutsRef.current[typingUserId];
            }, 3000);
        }
      })
      .on('broadcast', { event: 'new_message' }, (payload) => {
         if (payload.payload.user_id !== userId) {
            setMessages(prev => {
              if (prev.find(m => m.content === payload.payload.content || m.id === payload.payload.id)) return prev;
              return [...prev, {
                id: payload.payload.id || Date.now().toString(),
                role: payload.payload.role,
                content: payload.payload.content,
                sources: payload.payload.sources,
                confidence: payload.payload.confidence,
                generatedBy: payload.payload.generatedBy,
                user_id: payload.payload.user_id
              }];
            });
         }
      })
      .on('broadcast', { event: 'room_deleted' }, () => {
         alert('The room owner has deleted this collaborative room.');
         router.replace('/dashboard');
      })
      .subscribe((status, error) => {
         console.log(`[Collab Debug] Room Channel Subscription Status: ${status}`, error);
      });

    activeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(globalChannel);
      supabase.removeChannel(channel);
    };
  }, [activeSessionId, userId]);


  const loadMessages = async (sid: string, forcedUserId?: string) => {
    const uid = forcedUserId || userId;
    if (!uid) return;
    
    setActiveSessionId(sid);
    setLoading(true);
    
    const query = supabase.from('chat_history').select('*');
    
    if (sid === 'legacy-chat') {
       query.is('session_id', null).eq('user_id', uid);
       setRoomOwnerId(null);
    } else {
       query.eq('session_id', sid);
       if (sid.startsWith('collab-')) {
          const { data: roomData } = await supabase.from('collab_rooms').select('owner_id').eq('id', sid).single();
          if (roomData) {
             setRoomOwnerId(roomData.owner_id);
          } else {
             setRoomOwnerId(null);
          }
       } else {
          setRoomOwnerId(null);
       }
    }
    
    const { data } = await query.order('created_at', { ascending: true });
    
    if (data) {
      setMessages(data.map((d: any) => ({
        id: d.id?.toString() || Date.now().toString(),
        role: d.role,
        content: d.content,
        user_id: d.user_id
      })));
    } else {
      setMessages([]);
    }
    setLoading(false);
  };

  const startNewPrivateConversation = () => {
    setActiveSessionId(`session-${Date.now()}`);
    setMessages([]);
    setIsSidebarOpen(false);
    // Remove query param
    router.replace('/dashboard', undefined);
  };

  const startNewCollabRoom = async () => {
    const collabId = `collab-${Date.now()}`;
    setActiveSessionId(collabId);
    setMessages([]);
    setIsSidebarOpen(false);
    if (userId) {
       setRoomOwnerId(userId);
       setParticipantCount(1);
       await supabase.from('collab_rooms').insert({ id: collabId, owner_id: userId });
       await supabase.from('collab_members').insert({ room_id: collabId, user_id: userId });
    }
    router.replace(`/dashboard?room=${collabId}`, undefined);
  };

  const deletePrivateSession = async (e: React.MouseEvent, sid: string) => {
     e.stopPropagation();
     if (!userId) return;
     setSessions(prev => prev.filter(s => s.id !== sid));
     if (activeSessionId === sid) {
        startNewPrivateConversation();
     }
     if (sid === 'legacy-chat') {
       await supabase.from('chat_history').delete().is('session_id', null).eq('user_id', userId);
     } else {
       await supabase.from('chat_history').delete().eq('session_id', sid).eq('user_id', userId);
     }
  };

  const leaveCollabRoom = async () => {
     if (!userId || !activeSessionId) return;
     await supabase.from('collab_members').delete().match({ room_id: activeSessionId, user_id: userId });
     setSessions(prev => prev.filter(s => s.id !== activeSessionId));
     startNewPrivateConversation();
  };

  const deleteCollabRoom = async () => {
     if (!activeSessionId) return;
     const roomIdToDelete = activeSessionId;
     
     // 1. Broadcast the deletion event to all connected peers FIRST.
     // The channel is already open from our active subscription.
     await activeChannelRef.current?.send({
        type: 'broadcast',
        event: 'room_deleted',
        payload: {}
     });

     // 2. Delete the records from the database
     await supabase.from('collab_rooms').delete().eq('id', roomIdToDelete);
     await supabase.from('chat_history').delete().eq('session_id', roomIdToDelete);
     
     // 3. Update local UI
     setSessions(prev => prev.filter(s => s.id !== roomIdToDelete));
     startNewPrivateConversation();
  };

  const copyRoomLink = () => {
    if (!activeSessionId) return;
    const url = `${window.location.origin}/dashboard?room=${activeSessionId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ensureSaveToHistory = async (role: 'user' | 'assistant', content: string, currentSessionId: string, isFirstInSession: boolean, titleCandidate?: string) => {
    if (!userId) return;
    
    let title = currentSessionId.startsWith('collab-') ? "Shared Room" : "New Conversation";
    
    if (isFirstInSession && titleCandidate) {
      // Create title from first 25 chars
      title = titleCandidate.substring(0, 25) + (titleCandidate.length > 25 ? '...' : '');
      title = (currentSessionId.startsWith('collab-') ? "👥 " : "") + title;
      
      // Update sidebar optimally
      setSessions(prev => {
        if (!prev.find(s => s.id === currentSessionId)) {
          return [{ id: currentSessionId, title, isCollab: currentSessionId.startsWith('collab-') }, ...prev];
        }
        return prev;
      });
    } else {
       // Look up existing title to push alongside logic
       const existing = sessions.find(s => s.id === currentSessionId);
       if (existing) title = existing.title;
    }

    await supabase.from('chat_history').insert({
      user_id: userId,
      role,
      content,
      session_id: currentSessionId,
      session_title: title
    });
  };

  const toggleListen = () => {
    if (isListening) recognitionRef.current?.stop();
    else { recognitionRef.current?.start(); setIsListening(true); }
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
    import('html2pdf.js').then((html2pdfModule) => {
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
        
        const html2pdf = html2pdfModule as any;
        const generator = html2pdf.default || html2pdf;
        generator().set(opt).from(cloned).save();
      }
    });
  };

  const processStream = async (queryToProcess: string, apiMode: string) => {
    // Capture state immediately so we know if this triggers a new sidebar title
    const isFirstInSession = messages.length === 0;
    const currentSessionId = activeSessionId || `session-${Date.now()}`;
    if (!activeSessionId) setActiveSessionId(currentSessionId);
    
    // Optimistic UI for User
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: queryToProcess, user_id: userId! };
    setMessages(prev => [...prev, userMessage]);
    ensureSaveToHistory('user', queryToProcess, currentSessionId, isFirstInSession, queryToProcess);
    
    // Broadcast user message to peers instantly
    if (currentSessionId.startsWith('collab-')) {
       activeChannelRef.current?.send({
          type: 'broadcast',
          event: 'new_message',
          payload: userMessage
       });
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
           'Content-Type': 'application/json',
           ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
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
        generatedBy,
        user_id: userId!
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
      
      // Save full generation to database (Triggers Realtime for other peers in Collab mode)
      ensureSaveToHistory('assistant', assistantContent, currentSessionId, false);
      
      // Broadcast assistant message to peers instantly
      if (currentSessionId.startsWith('collab-')) {
         activeChannelRef.current?.send({
            type: 'broadcast',
            event: 'new_message',
            payload: {
               id: assistantId,
               role: 'assistant',
               content: assistantContent,
               sources,
               confidence,
               generatedBy,
               user_id: userId!
            }
         });
      }
      
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
    <div className="chat-container">
      
      {/* LEFT SIDEBAR: Sessions */}
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="chat-sidebar-overlay" 
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', 
            zIndex: 40, backdropFilter: 'blur(2px)'
          }}
        />
      )}
      <div className={`chat-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            onClick={startNewPrivateConversation}
            style={{ 
              width: '100%', padding: '10px', background: 'transparent', 
              border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-primary)', 
              borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', gap: '8px', fontWeight: 600, transition: 'all 0.3s' 
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <PlusCircle size={20} /> Private Chat
          </button>
          
          <button 
            onClick={startNewCollabRoom}
            style={{ 
              width: '100%', padding: '10px', background: 'transparent', 
              border: '1px solid var(--color-neon-yellow)', color: 'var(--color-neon-yellow)', 
              borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', gap: '8px', fontWeight: 600, transition: 'all 0.3s' 
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(253, 224, 71, 0.1)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <UsersThree size={20} weight="fill" /> Collab Room
          </button>
        </div>
        
        <div style={{ padding: '0 20px', paddingBottom: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
          Recent
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '0 10px' }}>
          {sessions.map(sess => (
            <div key={sess.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '4px', position: 'relative' }} className="session-item">
              <button 
                onClick={() => {
                   loadMessages(sess.id);
                   setIsSidebarOpen(false);
                   if (sess.isCollab) {
                      router.replace(`/dashboard?room=${sess.id}`, undefined);
                   } else {
                      router.replace(`/dashboard`, undefined);
                   }
                }}
                style={{ 
                  flex: 1,
                  padding: '12px 15px', 
                  background: activeSessionId === sess.id ? 'rgba(253, 224, 71, 0.1)' : 'transparent',
                  border: 'none',
                  borderLeft: activeSessionId === sess.id ? `3px solid ${sess.isCollab ? '#c084fc' : 'var(--color-neon-yellow)'}` : '3px solid transparent',
                  color: activeSessionId === sess.id ? (sess.isCollab ? '#c084fc' : 'var(--color-neon-yellow)') : 'var(--text-secondary)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s',
                  paddingRight: '30px'
                }}
                onMouseOver={(e) => { if(activeSessionId !== sess.id) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseOut={(e) => { if(activeSessionId !== sess.id) e.currentTarget.style.background = 'transparent'; }}
              >
                {sess.isCollab ? <UsersThree size={18} /> : <ChatCircleText size={18} />}
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                  {sess.title}
                </span>
              </button>
              
              {!sess.isCollab && (
                 <button
                    onClick={(e) => deletePrivateSession(e, sess.id)}
                    style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', color: 'var(--color-red)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    title="Delete Conversation"
                 >
                    <Trash size={16} />
                 </button>
              )}
            </div>
          ))}
          {sessions.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '20px' }}>
              No history yet. Start exploring!
            </div>
          )}
        </div>
        
        {/* Document Uploader */}
        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
           <Uploader />
        </div>
      </div>

      {/* RIGHT PANE: Chat Viewport */}
      <div className="chat-viewport">
        
        {/* Header Settings */}
        <div className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: activeSessionId?.startsWith('collab-') ? '#c084fc' : 'var(--color-neon-yellow)' }}>
            <button 
              className="mobile-menu-toggle"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-primary)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <List size={24} />
            </button>
            {activeSessionId?.startsWith('collab-') ? <UsersThree size={24} weight="fill" /> : <Robot size={24} />}
            <span style={{ fontWeight: 600 }}>
              {activeSessionId?.startsWith('collab-') ? `Live Collab Room (${participantCount} peer${participantCount !== 1 ? 's' : ''})` : 'Tiger AI Engine'}
            </span>
          </div>
          <div className="chat-header-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {activeSessionId?.startsWith('collab-') && (
               <>
                 <button 
                   onClick={leaveCollabRoom}
                   style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)', border: '1px solid var(--text-secondary)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                   title="Leave this room"
                 >
                   <SignOut size={16} /> Leave
                 </button>
                 {userId === roomOwnerId && (
                   <button 
                     onClick={deleteCollabRoom}
                     style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-red)', border: '1px solid var(--color-red)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                     title="Delete this room entirely"
                   >
                     <WarningCircle size={16} /> Delete Room
                   </button>
                 )}
                 <button 
                  onClick={copyRoomLink}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: copied ? 'rgba(74, 222, 128, 0.2)' : 'rgba(192, 132, 252, 0.1)',
                    color: copied ? '#4ade80' : '#c084fc',
                    border: `1px solid ${copied ? '#4ade80' : '#c084fc'}`,
                    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                 >
                   {copied ? <CheckCircle size={16} /> : <LinkIcon size={16} />}
                   {copied ? 'Copied Link!' : 'Share Room'}
                 </button>
               </>
            )}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-color)', padding: '4px', borderRadius: '8px', border: '1px solid var(--color-medium-grey)' }}>
              <button 
                onClick={() => setMode('short')} 
                style={{ 
                  background: mode === 'short' ? 'var(--color-dark-grey)' : 'transparent',
                  color: mode === 'short' ? 'var(--color-neon-yellow)' : 'var(--text-secondary)',
                  border: mode === 'short' ? '1px solid var(--color-neon-yellow)' : '1px solid transparent',
                  padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem'
                }}
              >
                Short
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
                Long
              </button>
            </div>
          </div>
        </div>

        {/* Messages Window */}
        <div className="chat-messages-window">
          {messages.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {activeSessionId?.startsWith('collab-') ? (
                <>
                  <UsersThree size={48} color="#c084fc" style={{ opacity: 0.8, marginBottom: '15px' }} />
                  <p style={{ marginBottom: '10px', fontWeight: 600, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Empty Collaborative Room</p>
                  <p style={{ fontSize: '0.9rem' }}>Share the link above with friends. Everything asked here updates live!</p>
                </>
              ) : (
                <>
                  <Robot size={48} style={{ opacity: 0.3, marginBottom: '15px' }} />
                  <p style={{ marginBottom: '10px', fontWeight: 600, fontSize: '1.2rem', color: 'var(--text-primary)' }}>How can I help you today?</p>
                  <p style={{ fontSize: '0.9rem' }}>Ask me practically anything about the documents you've uploaded.</p>
                </>
              )}
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} style={{ 
                alignSelf: msg.user_id === userId ? 'flex-end' : 'flex-start', 
                maxWidth: '80%' 
            }}>
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
              {msg.role === 'user' && msg.user_id !== userId && activeSessionId?.startsWith('collab-') && (
                <div style={{ fontSize: '0.75rem', color: '#c084fc', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <UsersThree size={12} weight="fill"/> Peer User
                </div>
              )}
              
              <div id={`msg-${msg.id}`} style={{ 
                background: msg.role === 'user' 
                   ? (msg.user_id === userId ? 'var(--color-dark-grey)' : 'rgba(192, 132, 252, 0.1)') 
                   : 'rgba(253, 224, 71, 0.05)', 
                border: msg.role === 'user' 
                   ? (msg.user_id === userId ? '1px solid var(--color-medium-grey)' : '1px solid rgba(192, 132, 252, 0.3)') 
                   : '1px solid rgba(253, 224, 71, 0.3)',
                padding: '16px', 
                borderRadius: '12px',
                borderBottomRightRadius: msg.user_id === userId && msg.role === 'user' ? '4px' : '12px',
                borderBottomLeftRadius: msg.user_id !== userId && msg.role === 'user' ? '4px' : '12px',
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
                      <DownloadSimple size={14} weight="bold" /> Download Formatted Sheet
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
          
          {typingUsers.length > 0 && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', color: '#c084fc', fontStyle: 'italic', fontSize: '0.9rem', padding: '8px 16px', background: 'rgba(192, 132, 252, 0.1)', borderRadius: '12px', borderBottomLeftRadius: '4px' }}>
              <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                 <span style={{ height: '6px', width: '6px', background: '#c084fc', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite cubic-bezier(0.2, 0.8, 0.2, 1)' }}></span>
                 <span style={{ height: '6px', width: '6px', background: '#c084fc', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite cubic-bezier(0.2, 0.8, 0.2, 1)', animationDelay: '0.2s' }}></span>
                 <span style={{ height: '6px', width: '6px', background: '#c084fc', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite cubic-bezier(0.2, 0.8, 0.2, 1)', animationDelay: '0.4s' }}></span>
              </div>
              <span style={{ opacity: 0.8 }}>{typingUsers.length === 1 ? 'A peer is typing...' : `${typingUsers.length} peers are typing...`}</span>
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
              onChange={(e) => {
                 setInput(e.target.value);
                 if (activeSessionId?.startsWith('collab-') && e.target.value.trim().length > 0) {
                    activeChannelRef.current?.send({
                       type: 'broadcast',
                       event: 'typing',
                       payload: { user_id: userId }
                    });
                 }
              }}
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
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

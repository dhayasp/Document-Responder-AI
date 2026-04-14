'use client';

import { useState, useRef } from 'react';
import { UploadSimple, FileText, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase';

export default function Uploader() {
  const [files, setFiles] = useState<{name: string, progress: number, status: 'uploading' | 'done' | 'error'}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const selectedFiles = Array.from(e.target.files);
    
    const newFiles = selectedFiles.map(f => ({ name: f.name, progress: 0, status: 'uploading' as const }));
    setFiles(prev => [...prev, ...newFiles]);

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        // Simulate progress for UI purposes initially
        const progressInterval = setInterval(() => {
          setFiles(prev => prev.map(f => f.name === file.name && f.progress < 90 ? { ...f, progress: f.progress + 10 } : f));
        }, 300);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        clearInterval(progressInterval);

        if (res.ok) {
          setFiles(prev => prev.map(f => f.name === file.name ? { ...f, progress: 100, status: 'done' } : f));
          
          // Broadcast to the whole application
          const channel = supabase.channel('global_notifications');
          channel.subscribe(async (status) => {
             if (status === 'SUBSCRIBED') {
                await channel.send({ type: 'broadcast', event: 'document_uploaded', payload: { filename: file.name } });
                supabase.removeChannel(channel);
             }
          });
        } else {
          setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error' } : f));
        }
      } catch (error) {
        setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error' } : f));
      }
    }
    
    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div 
        style={{ 
          border: '2px dashed var(--color-medium-grey)', 
          borderRadius: '12px', 
          padding: '2rem 1rem', 
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.3s, background 0.3s'
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-neon-yellow)'; }}
        onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-medium-grey)'; }}
        onDrop={(e) => {
           e.preventDefault();
           e.currentTarget.style.borderColor = 'var(--color-medium-grey)';
           if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && fileInputRef.current) {
             const dataTransfer = new DataTransfer();
             Array.from(e.dataTransfer.files).forEach(f => fileTransferChecker(f, dataTransfer));
             fileInputRef.current.files = dataTransfer.files;
             fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
           }
        }}
      >
        <UploadSimple size={32} color="var(--color-neon-yellow)" style={{ marginBottom: '10px' }} />
        <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '5px' }}>Click or drag files here</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Supported: TXT, PDF, DOCX</p>
        
        <input 
          type="file" 
          multiple 
          accept=".txt,.pdf,.docx" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileChange}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {files.map((file, idx) => (
          <div key={idx} style={{ 
            background: 'var(--bg-color)', 
            border: '1px solid var(--color-medium-grey)', 
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
             <FileText size={24} color="var(--text-secondary)" />
             <div style={{ flex: 1, overflow: 'hidden' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                 <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
                 {file.status === 'done' && <CheckCircle size={16} color="var(--color-neon-yellow)" />}
                 {file.status === 'error' && <WarningCircle size={16} color="var(--color-red)" />}
               </div>
               {file.status === 'uploading' && (
                 <div style={{ width: '100%', height: '4px', background: 'var(--color-medium-grey)', borderRadius: '2px', overflow: 'hidden' }}>
                   <div style={{ width: `${file.progress}%`, height: '100%', background: 'var(--color-neon-yellow)', transition: 'width 0.3s' }}></div>
                 </div>
               )}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fileTransferChecker(file: File, dt: DataTransfer) {
  const allowed = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowed.includes(file.type) || file.name.endsWith('.txt') || file.name.endsWith('.pdf') || file.name.endsWith('.docx')) {
    dt.items.add(file);
  }
}

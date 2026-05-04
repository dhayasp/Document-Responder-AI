import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '@/lib/embeddings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function callDeepSeekStream(prompt: string): Promise<Response> {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      stream: true
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek API Error: ${await res.text()}`);
  return res;
}

async function callGroqStream(prompt: string): Promise<Response> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      stream: true
    }),
  });
  if (!res.ok) throw new Error(`Groq API Error: ${await res.text()}`);
  return res;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { global: { headers: token ? { Authorization: `Bearer ${token}` } : {} } }
    );

    const { query, mode } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is missing' }, { status: 400 });
    }

    // 🔹 Handle 'general' mode
    if (mode === 'general') {
      const generalPrompt = `
You are an expert Educational AI assistant. 
Answer the following question using your vast general knowledge.
Format your answer clearly using Markdown: 
- Use headings (## or ###) for sections.
- Use bullet points for lists.
- Make it easy and ready to read for exams.

Question: ${query}
Answer:`;

      let apiResponse: Response;
      let generatedBy = 'DeepSeek';
      try {
        if (!process.env.DEEPSEEK_API_KEY) throw new Error('No DeepSeek key');
        apiResponse = await callDeepSeekStream(generalPrompt);
      } catch (e: any) {
        generatedBy = 'Groq (Fallback)';
        apiResponse = await callGroqStream(generalPrompt);
      }

      const headers = new Headers(apiResponse.headers);
      headers.set('X-Sources', encodeURIComponent(JSON.stringify([])));
      headers.set('X-Confidence', '1');
      headers.set('X-Generated-By', generatedBy);

      return new Response(apiResponse.body, { status: 200, headers });
    }

    // 🔹 1. Generate embedding
    const queryEmbedding = await generateEmbedding(query);

    if (!queryEmbedding) {
      return NextResponse.json({ error: 'Embedding failed' }, { status: 500 });
    }

    // 🔹 2. Search in Supabase
    const { data: chunks, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.1,
      match_count: 5
    });

    if (error) {
      console.error('Vector Search Error:', error);
      return NextResponse.json({ error: 'DB search failed' }, { status: 500 });
    }

    // 🔴 FIX 1: No documents case
    if (!chunks || chunks.length === 0) {
      return NextResponse.json({
        answer: "No relevant document found. Please upload a document or use 'Ask General AI Knowledge'.",
        sources: [],
        confidence: 0,
        generatedBy: "System"
      });
    }

    // 🔹 3. Use only top results
    const topChunks = chunks.slice(0, 3);
    let contextStr = '';
    let sourcesSet = new Set<string>();

    topChunks.forEach((chunk: any) => {
      contextStr += `\n[Source: ${chunk.filename}]:\n${chunk.content}\n`;
      sourcesSet.add(chunk.filename);
    });

    const confidence = topChunks[0]?.similarity || 0;

    // 🔹 4. Prompt
    const instructions = mode === 'short'
      ? "Provide a short, direct answer with key points only."
      : "Provide a highly detailed, comprehensive explanation.";

    const prompt = `
You are Tiger AI, an assistant that helps users understand their documents.
Answer ONLY using the provided text context. Do not make up information outside of it.
If the context completely fails to answer the question, say: "I couldn't find the exact answer in your documents. Try using 'Ask General AI Knowledge'."

IMPORTANT EXAM-READY FORMATTING:
- Structure the answer beautifully using Markdown.
- Use # and ## headings to organize thoughts.
- Use bullet points for key items.
- Ensure proper spacing for readability.

Mode Instructions: ${instructions}

===== CONTEXT =====
${contextStr}
===================

Question: ${query}
Answer:
`;

    // 🔹 5. AI Response Streaming
    let apiResponse: Response;
    let generatedBy = 'DeepSeek';

    try {
      if (!process.env.DEEPSEEK_API_KEY) throw new Error('No DeepSeek key');
      apiResponse = await callDeepSeekStream(prompt);
    } catch (e: any) {
      console.warn("DeepSeek failed → using Groq");
      generatedBy = 'Groq (Fallback)';
      apiResponse = await callGroqStream(prompt);
    }

    const headers = new Headers(apiResponse.headers);
    headers.set('X-Sources', encodeURIComponent(JSON.stringify(Array.from(sourcesSet))));
    headers.set('X-Confidence', confidence.toString());
    headers.set('X-Generated-By', generatedBy);

    return new Response(apiResponse.body, { status: 200, headers });

  } catch (err: any) {
    console.error('Chat Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
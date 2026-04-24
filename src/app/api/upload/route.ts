import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { generateEmbedding, chunkText } from '@/lib/embeddings';
import mammoth from 'mammoth';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log("📄 File received:", file.name);

    let rawText = '';

    // 🔹 TXT
    if (file.type === 'text/plain') {
      const buffer = Buffer.from(await file.arrayBuffer());
      rawText = buffer.toString('utf-8');
    }

    // 🔹 PDF (STABLE EXTRACTION)
    else if (file.type === 'application/pdf') {
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // We use pdf-parse@1.1.1 which safely bundles worker logic in Next.js backend
      const pdfParse = (await import('pdf-parse')).default;
      
      const data = await pdfParse(buffer);
      
      rawText = data.text;
    }

    // 🔹 DOCX
    else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const docxData = await mammoth.extractRawText({ buffer });
      rawText = docxData.value;
    }

    else {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // ❗ Check extracted text
    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json({ error: 'Could not extract text (empty PDF or scanned file)' }, { status: 400 });
    }

    console.log("📄 Extracted text length:", rawText.length);

    // 🔹 Chunking
    const chunks = chunkText(rawText).filter(c => c.trim().length > 0);
    console.log("🔹 Total chunks:", chunks.length);

    // 🔹 Insert into Supabase
    for (const content of chunks) {
      const embedding = await generateEmbedding(content);

      if (!embedding || embedding.length !== 384) {
        console.warn("⚠️ Invalid embedding skipped");
        continue;
      }

      const { error } = await supabase
        .from('document_chunks')
        .insert({
          filename: file.name,
          content,
          embedding
        });

      if (error) {
        console.error("❌ Supabase Insert Error:", error.message);
        throw new Error(error.message);
      }
    }

    return NextResponse.json({
      success: true,
      chunksCount: chunks.length
    });

  } catch (err: any) {
    console.error('❌ Upload Process Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
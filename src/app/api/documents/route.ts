import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const mode = url.searchParams.get('mode') || 'private';
    const roomId = url.searchParams.get('roomId');

    const { data: { user } } = await supabase.auth.getUser(token);

    // Fetch all filenames and deduplicate
    let query = supabase.from('document_chunks').select('filename, user_id');

    if (mode === 'collab' && roomId) {
      query = query.eq('mode', 'collab').eq('room_id', roomId);
    } else {
      query = query.eq('mode', 'private').eq('user_id', user?.id);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    const uniqueDocs = new Map();
    data.forEach((row: any) => {
       if (!uniqueDocs.has(row.filename)) {
          uniqueDocs.set(row.filename, { filename: row.filename, uploaded_by: row.user_id });
       }
    });

    return NextResponse.json({ documents: Array.from(uniqueDocs.values()) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
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

    const { filename, mode, roomId } = await req.json();
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    // Hard delete all chunks belonging to this document for this user and context
    let query = supabase
      .from('document_chunks')
      .delete()
      .eq('filename', filename)
      .eq('user_id', user?.id);
      
    if (mode === 'collab' && roomId) {
       query = query.eq('mode', 'collab').eq('room_id', roomId);
    } else {
       query = query.eq('mode', 'private');
    }

    const { error } = await query;

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, filename });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

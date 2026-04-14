import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch all filenames and deduplicate
    const { data, error } = await supabase
      .from('document_chunks')
      .select('filename');

    if (error) throw new Error(error.message);

    const filenames = Array.from(new Set(data.map((row: any) => row.filename)));

    return NextResponse.json({ filenames });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { filename } = await req.json();
    
    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    // Hard delete all chunks belonging to this document
    const { error } = await supabase
      .from('document_chunks')
      .delete()
      .eq('filename', filename);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, filename });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

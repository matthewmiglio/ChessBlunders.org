import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const MAX_TEXT_LENGTH = 1000;
const MAX_NAME_LENGTH = 100;
const VALID_CATEGORIES = ['bug', 'feature', 'ux', 'puzzles', 'other'];

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Must be logged in to submit feedback' }, { status: 401 });
    }

    const body = await req.json();
    const { name, text, stars, category } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ error: `Name must be ${MAX_NAME_LENGTH} characters or less` }, { status: 400 });
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Feedback text is required' }, { status: 400 });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: `Feedback must be ${MAX_TEXT_LENGTH} characters or less` }, { status: 400 });
    }

    const validStars = typeof stars === 'number' && stars >= 0 && stars <= 5 ? stars : 0;
    const validCategory = VALID_CATEGORIES.includes(category) ? category : 'other';

    const { error } = await supabase.from('feedback').insert({
      user_id: user.id,
      name: name.trim(),
      email: user.email,
      text: text.trim(),
      stars: validStars,
      category: validCategory,
    });

    if (error) {
      console.error('[feedback] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[feedback] Error:', error);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}

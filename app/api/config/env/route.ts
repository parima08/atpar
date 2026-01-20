import { NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';

/**
 * GET /api/config/env - Check which environment variables are set (not their values)
 */
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      notionToken: !!process.env.NOTION_TOKEN,
      adoPat: !!process.env.ADO_PAT,
      adoOrgUrl: !!process.env.ADO_ORG_URL,
      // Return the org URL (not secret) for display
      adoOrgUrlValue: process.env.ADO_ORG_URL || '',
    });
  } catch (error) {
    console.error('Error checking env:', error);
    return NextResponse.json(
      { error: 'Failed to check environment' },
      { status: 500 }
    );
  }
}

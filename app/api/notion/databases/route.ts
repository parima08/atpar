import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { syncConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/notion/databases - List accessible Notion databases
 * Accepts token from request body for testing before save,
 * or falls back to team's stored token
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    let notionToken = body.notionToken;

    // If no token provided, try to get from team's stored config
    if (!notionToken) {
      const teamId = 1; // For simplicity, use team ID 1
      const config = await db.query.syncConfigs.findFirst({
        where: eq(syncConfigs.teamId, teamId),
      });
      notionToken = config?.notionToken;
    }

    if (!notionToken) {
      return NextResponse.json(
        { error: 'Notion token not provided' },
        { status: 400 }
      );
    }

    const notion = new Client({ auth: notionToken });
    
    // Search for all pages and filter databases client-side (API filter type is limited)
    const response = await notion.search({
      page_size: 100,
    });

    const databases = (response.results as Array<{ object: string; id: string; title?: Array<{ plain_text: string }>; url?: string }>)
      .filter(r => r.object === 'database' && 'title' in r)
      .map(db => ({
        id: db.id,
        title: db.title?.map(t => t.plain_text).join('') || 'Untitled',
        url: db.url || '',
      }));

    return NextResponse.json({ databases });
  } catch (error) {
    console.error('Error fetching Notion databases:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch databases' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notion/databases - List accessible Notion databases using stored token
 */
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamId = 1; // For simplicity, use team ID 1
    const config = await db.query.syncConfigs.findFirst({
      where: eq(syncConfigs.teamId, teamId),
    });

    const notionToken = config?.notionToken;
    if (!notionToken) {
      return NextResponse.json(
        { error: 'Notion token not configured' },
        { status: 400 }
      );
    }

    const notion = new Client({ auth: notionToken });
    
    const response = await notion.search({
      page_size: 100,
    });

    const databases = (response.results as Array<{ object: string; id: string; title?: Array<{ plain_text: string }>; url?: string }>)
      .filter(r => r.object === 'database' && 'title' in r)
      .map(db => ({
        id: db.id,
        title: db.title?.map(t => t.plain_text).join('') || 'Untitled',
        url: db.url || '',
      }));

    return NextResponse.json({ databases });
  } catch (error) {
    console.error('Error fetching Notion databases:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch databases' },
      { status: 500 }
    );
  }
}

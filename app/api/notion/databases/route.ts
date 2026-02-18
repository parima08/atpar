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

    // Use filter: database so Notion only returns databases (not pages), making pagination much faster
    const allResults: Array<Record<string, unknown>> = [];
    let cursor: string | undefined = undefined;

    do {
      const response = await notion.search({
        filter: { value: 'database', property: 'object' },
        page_size: 100,
        start_cursor: cursor,
      });
      allResults.push(...(response.results as typeof allResults));
      cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
    } while (cursor);

    const databases = allResults
      .filter(r => 'title' in r)
      .map((db: Record<string, unknown>) => {
        const icon = db.icon as { type?: string; emoji?: string; external?: { url: string } } | null;
        return {
          id: db.id as string,
          title: (db.title as Array<{ plain_text: string }>)?.map(t => t.plain_text).join('') || 'Untitled',
          url: (db.url as string) || '',
          icon: icon?.type === 'emoji' ? icon.emoji : icon?.type === 'external' ? icon.external?.url : null,
          iconType: icon?.type ?? null,
          lastEditedTime: (db.last_edited_time as string) || null,
        };
      });

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

    const allResults: Array<Record<string, unknown>> = [];
    let cursor: string | undefined = undefined;

    do {
      const response = await notion.search({
        filter: { value: 'database', property: 'object' },
        page_size: 100,
        start_cursor: cursor,
      });
      allResults.push(...(response.results as typeof allResults));
      cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
    } while (cursor);

    const databases = allResults
      .filter(r => 'title' in r)
      .map((db: Record<string, unknown>) => {
        const icon = db.icon as { type?: string; emoji?: string; external?: { url: string } } | null;
        return {
          id: db.id as string,
          title: (db.title as Array<{ plain_text: string }>)?.map(t => t.plain_text).join('') || 'Untitled',
          url: (db.url as string) || '',
          icon: icon?.type === 'emoji' ? icon.emoji : icon?.type === 'external' ? icon.external?.url : null,
          iconType: icon?.type ?? null,
          lastEditedTime: (db.last_edited_time as string) || null,
        };
      });

    return NextResponse.json({ databases });
  } catch (error) {
    console.error('Error fetching Notion databases:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch databases' },
      { status: 500 }
    );
  }
}

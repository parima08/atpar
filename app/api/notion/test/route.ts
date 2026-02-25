import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getUser, getTeamIdForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { syncConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/notion/test - Test Notion connection
 * Accepts token from request body for testing before save,
 * or falls back to team's stored token
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let notionToken = body.notionToken;

    // If no token provided, try to get from team's stored config
    if (!notionToken) {
      const teamId = await getTeamIdForUser();
      if (!teamId) {
        return NextResponse.json({ success: false, message: 'Team not found' });
      }
      const config = await db.query.syncConfigs.findFirst({
        where: eq(syncConfigs.teamId, teamId),
      });
      notionToken = config?.notionToken;
    }

    if (!notionToken) {
      return NextResponse.json({
        success: false,
        message: 'Notion token not provided',
      });
    }

    const notion = new Client({ auth: notionToken });
    
    // Try to get the bot user to verify the token works
    const response = await notion.users.me({});
    
    return NextResponse.json({
      success: true,
      message: `Connected as ${response.name || 'Notion Integration'}`,
      botId: response.id,
    });
  } catch (error) {
    console.error('Notion connection test failed:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to connect to Notion',
    });
  }
}

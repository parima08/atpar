import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { syncConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

/**
 * GET /api/config - Get sync configuration for current team
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For simplicity, use team ID 1 (in a real app, get from user's team)
    const teamId = 1;

    const config = await db.query.syncConfigs.findFirst({
      where: eq(syncConfigs.teamId, teamId),
    });

    if (!config) {
      // Return default config if none exists
      return NextResponse.json({
        id: null,
        teamId,
        notionToken: '',
        adoPat: '',
        adoOrgUrl: '',
        notionDatabaseIds: [],
        adoProject: '',
      });
    }

    // Return actual credentials (user is authenticated and viewing their own config)
    return NextResponse.json({
      ...config,
      notionToken: config.notionToken || '',
      adoPat: config.adoPat || '',
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/config - Save sync configuration
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const teamId = 1; // For simplicity, use team ID 1

    // Check if config already exists
    const existingConfig = await db.query.syncConfigs.findFirst({
      where: eq(syncConfigs.teamId, teamId),
    });

    // Build config data, only updating credentials if they're not masked
    const configData: Record<string, unknown> = {
      teamId,
      adoProject: body.adoProject || null,
      notionDatabaseIds: body.notionDatabaseIds || [],
      updatedAt: new Date(),
    };

    // Update credentials if they're provided
    if (body.notionToken) {
      configData.notionToken = body.notionToken;
    }
    if (body.adoPat) {
      configData.adoPat = body.adoPat;
    }
    if (body.adoOrgUrl) {
      configData.adoOrgUrl = body.adoOrgUrl;
    }

    let result;
    if (existingConfig) {
      // Update existing config
      result = await db
        .update(syncConfigs)
        .set(configData)
        .where(eq(syncConfigs.teamId, teamId))
        .returning();
    } else {
      // Insert new config
      result = await db
        .insert(syncConfigs)
        .values(configData as typeof syncConfigs.$inferInsert)
        .returning();
    }

    // Return actual credentials
    const savedConfig = result[0];
    return NextResponse.json({
      ...savedConfig,
      notionToken: savedConfig.notionToken || '',
      adoPat: savedConfig.adoPat || '',
    });
  } catch (error) {
    console.error('Error saving config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

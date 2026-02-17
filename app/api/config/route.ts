import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { syncConfigs, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import {
  createSyncSchedule,
  updateSyncSchedule,
  deleteSyncSchedule,
  scheduleToCron,
} from '@/lib/qstash';

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

    // Check if user has ADO tokens (from Microsoft login)
    const fullUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: {
        adoAccessToken: true,
        adoRefreshToken: true,
        adoTokenExpiresAt: true,
        microsoftEmail: true,
      },
    });

    const userHasAdoTokens = !!(fullUser?.adoAccessToken && fullUser?.adoRefreshToken);
    const userAdoEmail = fullUser?.microsoftEmail || null;

    if (!config) {
      // Return default config if none exists
      return NextResponse.json({
        id: null,
        teamId,
        notionToken: '',
        adoAuthType: 'oauth', // Default to OAuth for new users
        adoPat: '',
        adoOrgUrl: '',
        adoOAuthConnected: userHasAdoTokens, // Consider user's own tokens
        adoOAuthUserEmail: userAdoEmail,
        userHasAdoTokens,
        notionDatabaseIds: [],
        adoProject: '',
        adoAreaPath: '',
        adoWorkType: '',
        syncSchedule: 'manual',
        syncScheduleHour: 8,
        syncScheduleMinute: 0,
      });
    }

    // Check if OAuth token is still valid (from syncConfigs or user)
    const configOAuthConnected = config.adoAuthType === 'oauth' && 
      config.adoOAuthAccessToken && 
      config.adoOAuthTokenExpiresAt && 
      new Date(config.adoOAuthTokenExpiresAt) > new Date();

    // Return config with OAuth status (don't expose tokens directly)
    return NextResponse.json({
      ...config,
      notionToken: config.notionToken || '',
      adoPat: config.adoPat || '',
      adoOAuthConnected: configOAuthConnected || userHasAdoTokens,
      adoOAuthUserEmail: config.adoOAuthUserEmail || userAdoEmail,
      userHasAdoTokens,
      // Don't expose OAuth tokens to frontend
      adoOAuthAccessToken: undefined,
      adoOAuthRefreshToken: undefined,
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
      adoAreaPath: body.adoAreaPath || null,
      adoWorkType: body.adoWorkType || null,
      notionDatabaseIds: body.notionDatabaseIds || [],
      updatedAt: new Date(),
    };

    // Always save adoOrgUrl (used by both PAT and OAuth)
    if (body.adoOrgUrl !== undefined) {
      configData.adoOrgUrl = body.adoOrgUrl;
    }

    // Update credentials if they're provided
    if (body.notionToken) {
      configData.notionToken = body.notionToken;
    }
    
    // Handle ADO auth type
    if (body.adoAuthType) {
      configData.adoAuthType = body.adoAuthType;
    }
    
    // Only update PAT credentials if using PAT auth
    if (body.adoAuthType === 'pat') {
      if (body.adoPat) {
        configData.adoPat = body.adoPat;
      }
    }
    
    // If switching to PAT, clear OAuth tokens
    if (body.adoAuthType === 'pat' && existingConfig?.adoAuthType === 'oauth') {
      configData.adoOAuthAccessToken = null;
      configData.adoOAuthRefreshToken = null;
      configData.adoOAuthTokenExpiresAt = null;
      configData.adoOAuthUserId = null;
      configData.adoOAuthUserEmail = null;
    }

    // Handle sync schedule and schedule time
    const newSchedule = body.syncSchedule as string | undefined;
    const oldSchedule = existingConfig?.syncSchedule || 'manual';
    const newHour = typeof body.syncScheduleHour === 'number' ? body.syncScheduleHour : (existingConfig?.syncScheduleHour ?? 8);
    const newMinute = typeof body.syncScheduleMinute === 'number' ? body.syncScheduleMinute : (existingConfig?.syncScheduleMinute ?? 0);
    const oldHour = existingConfig?.syncScheduleHour ?? 8;
    const oldMinute = existingConfig?.syncScheduleMinute ?? 0;
    const existingScheduleId = existingConfig?.qstashScheduleId;

    const scheduleOrTimeChanged =
      newSchedule !== oldSchedule ||
      (newSchedule !== 'manual' && (newHour !== oldHour || newMinute !== oldMinute));

    if (newSchedule) {
      configData.syncSchedule = newSchedule;
      configData.syncScheduleHour = Math.min(23, Math.max(0, newHour));
      configData.syncScheduleMinute = Math.min(59, Math.max(0, newMinute));
    }

    if (scheduleOrTimeChanged) {
      const cronExpression = newSchedule
        ? scheduleToCron(newSchedule as 'manual' | 'hourly' | 'daily', {
            hour: newSchedule === 'daily' ? newHour : undefined,
            minute: newMinute,
          })
        : null;

      if (cronExpression) {
        if (existingScheduleId) {
          const newScheduleId = await updateSyncSchedule(existingScheduleId, teamId, cronExpression);
          configData.qstashScheduleId = newScheduleId;
        } else {
          const scheduleId = await createSyncSchedule(teamId, cronExpression);
          configData.qstashScheduleId = scheduleId;
        }
      } else if (existingScheduleId) {
        await deleteSyncSchedule(existingScheduleId);
        configData.qstashScheduleId = null;
      }
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

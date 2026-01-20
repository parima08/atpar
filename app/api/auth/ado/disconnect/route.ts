import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { syncConfigs } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { eq } from 'drizzle-orm';

/**
 * POST /api/auth/ado/disconnect - Disconnect Azure DevOps OAuth
 * 
 * Clears OAuth tokens and reverts to PAT auth type.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamId = 1; // For simplicity

    await db
      .update(syncConfigs)
      .set({
        adoAuthType: 'pat',
        adoOAuthAccessToken: null,
        adoOAuthRefreshToken: null,
        adoOAuthTokenExpiresAt: null,
        adoOAuthUserId: null,
        adoOAuthUserEmail: null,
        adoOAuthOrgId: null,
        adoWebhookSubscriptionId: null,
        updatedAt: new Date(),
      })
      .where(eq(syncConfigs.teamId, teamId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting ADO OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}

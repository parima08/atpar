/**
 * Azure DevOps OAuth utilities
 */

import { db } from '@/lib/db/drizzle';
import { syncConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Refresh an expired OAuth access token using the refresh token
 */
export async function refreshAdoToken(teamId: number): Promise<string | null> {
  const config = await db.query.syncConfigs.findFirst({
    where: eq(syncConfigs.teamId, teamId),
  });

  if (!config?.adoOAuthRefreshToken) {
    console.error('No refresh token available');
    return null;
  }

  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('OAuth credentials not configured');
    return null;
  }

  try {
    const response = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: config.adoOAuthRefreshToken,
          grant_type: 'refresh_token',
          scope: '499b84ac-1321-427f-aa17-267ca6975798/user_impersonation offline_access',
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Token refresh failed:', errorData);
      
      // If refresh token is invalid/expired, clear OAuth data
      if (errorData.error === 'invalid_grant') {
        await db
          .update(syncConfigs)
          .set({
            adoAuthType: 'pat',
            adoOAuthAccessToken: null,
            adoOAuthRefreshToken: null,
            adoOAuthTokenExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(eq(syncConfigs.teamId, teamId));
      }
      
      return null;
    }

    const tokens: TokenResponse = await response.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Update stored tokens
    await db
      .update(syncConfigs)
      .set({
        adoOAuthAccessToken: tokens.access_token,
        adoOAuthRefreshToken: tokens.refresh_token,
        adoOAuthTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(syncConfigs.teamId, teamId));

    return tokens.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAdoToken(teamId: number): Promise<string | null> {
  const config = await db.query.syncConfigs.findFirst({
    where: eq(syncConfigs.teamId, teamId),
  });

  if (!config || config.adoAuthType !== 'oauth') {
    return null;
  }

  if (!config.adoOAuthAccessToken) {
    return null;
  }

  // Check if token is expired or will expire in the next 5 minutes
  const expiresAt = config.adoOAuthTokenExpiresAt;
  const bufferTime = 5 * 60 * 1000; // 5 minutes
  
  if (expiresAt && new Date(expiresAt).getTime() - Date.now() < bufferTime) {
    // Token is expired or about to expire, refresh it
    return await refreshAdoToken(teamId);
  }

  return config.adoOAuthAccessToken;
}

import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Refreshes the ADO access token for a user using their refresh token
 */
export async function refreshUserAdoToken(userId: number): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user?.adoRefreshToken) {
    console.error('No refresh token available for user:', userId);
    return null;
  }

  const clientId = process.env.AZURE_AD_CLIENT_ID!;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET!;

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
          refresh_token: user.adoRefreshToken,
          grant_type: 'refresh_token',
          scope: 'openid profile email offline_access 499b84ac-1321-427f-aa17-267ca6975798/user_impersonation',
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to refresh user ADO token:', errorData);

      // If refresh token is invalid, clear the user's ADO tokens
      if (errorData.error === 'invalid_grant') {
        await db
          .update(users)
          .set({
            adoAccessToken: null,
            adoRefreshToken: null,
            adoTokenExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      }

      return null;
    }

    const tokens = await response.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Update user with new tokens
    await db
      .update(users)
      .set({
        adoAccessToken: tokens.access_token,
        adoRefreshToken: tokens.refresh_token || user.adoRefreshToken,
        adoTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return tokens.access_token;
  } catch (error) {
    console.error('Error refreshing user ADO token:', error);
    return null;
  }
}

/**
 * Gets a valid ADO access token for a user, refreshing if necessary
 * 
 * @param userId - The user's ID
 * @returns The access token or null if unavailable
 */
export async function getValidUserAdoToken(userId: number): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    console.error('User not found:', userId);
    return null;
  }

  // If no ADO tokens, user needs to sign in with Microsoft
  if (!user.adoAccessToken) {
    return null;
  }

  // Check if token is expired or about to expire (within 5 minutes)
  const now = new Date();
  const expiresAt = user.adoTokenExpiresAt;
  const bufferTime = 5 * 60 * 1000; // 5 minutes

  if (!expiresAt || now.getTime() > expiresAt.getTime() - bufferTime) {
    // Token is expired or about to expire, refresh it
    console.log('User ADO token expired or expiring soon, refreshing...');
    return refreshUserAdoToken(userId);
  }

  return user.adoAccessToken;
}

/**
 * Check if a user has ADO connected
 */
export async function hasUserAdoConnection(userId: number): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      adoAccessToken: true,
      adoRefreshToken: true,
    },
  });

  return !!(user?.adoAccessToken && user?.adoRefreshToken);
}

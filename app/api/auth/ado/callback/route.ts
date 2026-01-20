import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { syncConfigs } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

interface UserProfile {
  id: string;
  displayName: string;
  emailAddress: string;
}

interface AdoOrganization {
  accountId: string;
  accountUri: string;
  accountName: string;
}

/**
 * GET /api/auth/ado/callback - Handles Azure DevOps OAuth callback
 * 
 * Exchanges authorization code for tokens and stores them in the database.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/sync?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || '')}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/sync?error=missing_code', request.url)
      );
    }

    // Verify state matches cookie
    const cookieStore = await cookies();
    const storedState = cookieStore.get('ado_oauth_state')?.value;

    if (!storedState || storedState !== state) {
      console.error('State mismatch:', { storedState, receivedState: state });
      return NextResponse.redirect(
        new URL('/sync?error=invalid_state', request.url)
      );
    }

    // Clear the state cookie
    cookieStore.delete('ado_oauth_state');

    // Verify user is authenticated
    const user = await getUser();
    if (!user) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    // Exchange code for tokens
    const clientId = process.env.AZURE_AD_CLIENT_ID!;
    const clientSecret = process.env.AZURE_AD_CLIENT_SECRET!;
    const redirectUri = process.env.AZURE_AD_REDIRECT_URI || 
      `${request.nextUrl.origin}/api/auth/ado/callback`;

    const tokenResponse = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/sync?error=token_exchange_failed', request.url)
      );
    }

    const tokens: TokenResponse = await tokenResponse.json();

    // Calculate token expiration time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Get user profile from Azure DevOps
    let userProfile: UserProfile | null = null;
    let organizations: AdoOrganization[] = [];

    try {
      // Get user profile
      const profileResponse = await fetch(
        'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.0',
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        }
      );

      if (profileResponse.ok) {
        userProfile = await profileResponse.json();
      }

      // Get user's organizations
      const orgsResponse = await fetch(
        'https://app.vssps.visualstudio.com/_apis/accounts?api-version=7.0',
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        }
      );

      if (orgsResponse.ok) {
        const orgsData = await orgsResponse.json();
        organizations = orgsData.value || [];
      }
    } catch (profileError) {
      console.error('Failed to fetch ADO profile:', profileError);
    }

    // Get or determine org URL
    // If user has organizations, use the first one as default
    const defaultOrgUrl = organizations.length > 0 
      ? `https://dev.azure.com/${organizations[0].accountName}`
      : null;

    // Store tokens in database
    const teamId = 1; // For simplicity - in production, get from user's team

    const existingConfig = await db.query.syncConfigs.findFirst({
      where: eq(syncConfigs.teamId, teamId),
    });

    const oauthData = {
      adoAuthType: 'oauth' as const,
      adoOAuthAccessToken: tokens.access_token,
      adoOAuthRefreshToken: tokens.refresh_token,
      adoOAuthTokenExpiresAt: expiresAt,
      adoOAuthUserId: userProfile?.id || null,
      adoOAuthUserEmail: userProfile?.emailAddress || null,
      adoOrgUrl: existingConfig?.adoOrgUrl || defaultOrgUrl,
      updatedAt: new Date(),
    };

    if (existingConfig) {
      await db
        .update(syncConfigs)
        .set(oauthData)
        .where(eq(syncConfigs.teamId, teamId));
    } else {
      await db.insert(syncConfigs).values({
        teamId,
        ...oauthData,
      });
    }

    // Redirect back to sync config with success
    const successUrl = new URL('/sync', request.url);
    successUrl.searchParams.set('oauth', 'success');
    if (userProfile?.emailAddress) {
      successUrl.searchParams.set('user', userProfile.emailAddress);
    }

    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/sync?error=callback_failed', request.url)
    );
  }
}

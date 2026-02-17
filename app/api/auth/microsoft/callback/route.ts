import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users, teams, teamMembers, activityLogs, invitations, ActivityType } from '@/lib/db/schema';
import { cookies } from 'next/headers';
import { eq, and } from 'drizzle-orm';
import { setSession } from '@/lib/auth/session';
import { startTrial } from '@/lib/db/trial';
import { createCheckoutSession } from '@/lib/payments/stripe';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

interface MicrosoftUserInfo {
  sub: string;  // Microsoft user ID
  name?: string;
  email?: string;
  preferred_username?: string;
}

/**
 * GET /api/auth/microsoft/callback - Handles Microsoft OAuth callback
 * 
 * This handles both sign-in and sign-up:
 * - If user exists (by microsoftId or email): Sign them in
 * - If user doesn't exist: Create account and sign them in
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
      console.error('Microsoft OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/?auth=signin&error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || '')}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/?auth=signin&error=missing_code', request.url)
      );
    }

    // Verify state matches cookie
    const cookieStore = await cookies();
    const storedState = cookieStore.get('microsoft_oauth_state')?.value;

    if (!storedState || storedState !== state) {
      console.error('State mismatch:', { storedState, receivedState: state });
      return NextResponse.redirect(
        new URL('/?auth=signin&error=invalid_state', request.url)
      );
    }

    // Parse state data
    let stateData: { csrf: string; redirect: string; priceId: string; inviteId: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return NextResponse.redirect(
        new URL('/?auth=signin&error=invalid_state', request.url)
      );
    }

    // Clear the state cookie
    cookieStore.delete('microsoft_oauth_state');

    // Exchange code for tokens
    const clientId = process.env.AZURE_AD_CLIENT_ID!;
    const clientSecret = process.env.AZURE_AD_CLIENT_SECRET!;
    const redirectUri = process.env.AZURE_AD_MICROSOFT_REDIRECT_URI 
      || process.env.AZURE_AD_REDIRECT_URI 
      || `${request.nextUrl.origin}/api/auth/microsoft/callback`;

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
        new URL('/?auth=signin&error=token_exchange_failed', request.url)
      );
    }

    const tokens: TokenResponse = await tokenResponse.json();

    // Get user info from Microsoft Graph
    const userInfoResponse = await fetch(
      'https://graph.microsoft.com/oidc/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    let userInfo: MicrosoftUserInfo | null = null;
    if (userInfoResponse.ok) {
      userInfo = await userInfoResponse.json();
    }

    if (!userInfo?.sub) {
      console.error('Failed to get user info from Microsoft');
      return NextResponse.redirect(
        new URL('/?auth=signin&error=user_info_failed', request.url)
      );
    }

    const microsoftId = userInfo.sub;
    const email = userInfo.email || userInfo.preferred_username || '';
    const name = userInfo.name || '';

    if (!email) {
      return NextResponse.redirect(
        new URL('/?auth=signin&error=no_email', request.url)
      );
    }

    // Calculate token expiration
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Check if user already exists (by microsoftId or email)
    let existingUser = await db.query.users.findFirst({
      where: eq(users.microsoftId, microsoftId),
    });

    // If not found by microsoftId, try by email (for linking existing accounts)
    if (!existingUser) {
      existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
    }

    let user: typeof users.$inferSelect;
    let isNewUser = false;

    if (existingUser) {
      // Update existing user with Microsoft info and ADO tokens
      const [updatedUser] = await db
        .update(users)
        .set({
          microsoftId,
          microsoftEmail: email,
          name: existingUser.name || name, // Don't overwrite existing name
          authProvider: existingUser.authProvider === 'email' ? existingUser.authProvider : 'microsoft',
          adoAccessToken: tokens.access_token,
          adoRefreshToken: tokens.refresh_token || existingUser.adoRefreshToken,
          adoTokenExpiresAt: tokenExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();

      user = updatedUser;
    } else {
      // Create new user
      isNewUser = true;
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          name,
          passwordHash: null, // No password for Microsoft users
          authProvider: 'microsoft',
          microsoftId,
          microsoftEmail: email,
          adoAccessToken: tokens.access_token,
          adoRefreshToken: tokens.refresh_token,
          adoTokenExpiresAt: tokenExpiresAt,
          role: 'owner',
        })
        .returning();

      user = newUser;
    }

    // Handle team membership
    let teamId: number | null = null;

    // Check if user already has a team
    const existingMembership = await db.query.teamMembers.findFirst({
      where: eq(teamMembers.userId, user.id),
    });

    if (existingMembership) {
      teamId = existingMembership.teamId;
    } else if (isNewUser) {
      // Handle invitation or create new team
      if (stateData.inviteId) {
        const [invitation] = await db
          .select()
          .from(invitations)
          .where(
            and(
              eq(invitations.id, parseInt(stateData.inviteId)),
              eq(invitations.email, email),
              eq(invitations.status, 'pending')
            )
          )
          .limit(1);

        if (invitation) {
          teamId = invitation.teamId;

          // Accept the invitation
          await db
            .update(invitations)
            .set({ status: 'accepted' })
            .where(eq(invitations.id, invitation.id));

          // Add user to team
          await db.insert(teamMembers).values({
            userId: user.id,
            teamId: invitation.teamId,
            role: invitation.role,
          });

          await db.insert(activityLogs).values({
            teamId,
            userId: user.id,
            action: ActivityType.ACCEPT_INVITATION,
          });
        }
      }

      // If still no team, create one
      if (!teamId) {
        const [newTeam] = await db
          .insert(teams)
          .values({
            name: `${name || email}'s Team`,
          })
          .returning();

        teamId = newTeam.id;

        // Start trial
        await startTrial(teamId);

        // Add user as owner
        await db.insert(teamMembers).values({
          userId: user.id,
          teamId,
          role: 'owner',
        });

        await db.insert(activityLogs).values({
          teamId,
          userId: user.id,
          action: ActivityType.CREATE_TEAM,
        });
      }
    }

    // Log the activity
    if (teamId) {
      await db.insert(activityLogs).values({
        teamId,
        userId: user.id,
        action: isNewUser ? ActivityType.MICROSOFT_SIGN_UP : ActivityType.MICROSOFT_SIGN_IN,
      });
    }

    // Set session
    await setSession(user);

    // Handle redirect
    if (stateData.redirect === 'checkout' && stateData.priceId) {
      const team = teamId
        ? await db.query.teams.findFirst({ where: eq(teams.id, teamId) })
        : null;
      if (team) {
        const checkoutResult = await createCheckoutSession({
          team,
          priceId: stateData.priceId,
        });
        if ('url' in checkoutResult && checkoutResult.url) {
          return NextResponse.redirect(checkoutResult.url);
        }
      }
    }

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/sync', request.url));
  } catch (error) {
    console.error('Microsoft OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/?auth=signin&error=callback_failed', request.url)
    );
  }
}

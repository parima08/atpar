import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users, teams, teamMembers, activityLogs, ActivityType } from '@/lib/db/schema';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { setSession } from '@/lib/auth/session';
import { startTrial } from '@/lib/db/trial';

const NOTION_API_BASE = 'https://api.notion.com';
const NOTION_VERSION = '2022-06-28'; // OAuth endpoints accept older version

interface NotionTokenResponse {
  access_token: string;
  workspace_id?: string;
  workspace_name?: string;
  bot_id?: string;
  owner?: {
    type: 'user';
    user: {
      id: string;
      name: string | null;
      avatar_url?: string | null;
      person?: { email?: string };
    };
  };
}

interface NotionBotUser {
  id: string;
  object: string;
  name: string | null;
  avatar_url: string | null;
  type: 'bot';
  bot?: {
    owner?: { type: 'user'; user: { id: string; name: string | null; person?: { email?: string } } };
  };
}

/**
 * GET /api/auth/notion/callback - Handles Notion OAuth callback
 * Exchanges code for token, fetches owner via /users/me, then finds or creates user and sets session.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      console.error('Notion OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/?auth=signin&error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || '')}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/?auth=signin&error=missing_code', request.url));
    }

    const cookieStore = await cookies();
    const storedState = cookieStore.get('notion_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(new URL('/?auth=signin&error=invalid_state', request.url));
    }
    cookieStore.delete('notion_oauth_state');

    const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
    const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET;
    const redirectUri =
      process.env.NOTION_REDIRECT_URI ||
      `${request.nextUrl.origin}/api/auth/notion/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL('/?auth=signin&error=oauth_not_configured', request.url));
    }

    const tokenRes = await fetch(`${NOTION_API_BASE}/v1/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      console.error('Notion token exchange failed:', err);
      return NextResponse.redirect(new URL('/?auth=signin&error=token_exchange_failed', request.url));
    }

    const tokenData: NotionTokenResponse = await tokenRes.json();
    const accessToken = tokenData.access_token;

    let notionId: string;
    let name: string;
    let email: string;

    if (tokenData.owner?.type === 'user' && tokenData.owner.user?.id) {
      const owner = tokenData.owner.user;
      notionId = owner.id;
      name = owner.name ?? '';
      email = owner.person?.email ?? `notion-${notionId}@users.atpar.notion`;
    } else {
      const meRes = await fetch(`${NOTION_API_BASE}/v1/users/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Notion-Version': NOTION_VERSION,
        },
      });
      if (!meRes.ok) {
        console.error('Notion /users/me failed:', meRes.status);
        return NextResponse.redirect(new URL('/?auth=signin&error=user_info_failed', request.url));
      }
      const me: NotionBotUser = await meRes.json();
      const owner = me.bot?.owner?.type === 'user' ? me.bot.owner.user : null;
      if (!owner?.id) {
        return NextResponse.redirect(new URL('/?auth=signin&error=user_info_failed', request.url));
      }
      notionId = owner.id;
      name = owner.name ?? '';
      email = owner.person?.email ?? `notion-${notionId}@users.atpar.notion`;
    }

    let existingUser = await db.query.users.findFirst({
      where: eq(users.notionId, notionId),
    });
    if (!existingUser) {
      existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
    }

    let user: typeof users.$inferSelect;
    let isNewUser = false;

    if (existingUser) {
      const [updated] = await db
        .update(users)
        .set({
          notionId,
          notionAccessToken: accessToken,
          name: existingUser.name || name,
          authProvider: existingUser.authProvider === 'email' ? existingUser.authProvider : 'notion',
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      user = updated;
    } else {
      isNewUser = true;
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          name,
          passwordHash: null,
          authProvider: 'notion',
          notionId,
          notionAccessToken: accessToken,
          role: 'owner',
        })
        .returning();
      user = newUser;
    }

    let teamId: number | null = null;
    const existingMembership = await db.query.teamMembers.findFirst({
      where: eq(teamMembers.userId, user.id),
    });

    if (existingMembership) {
      teamId = existingMembership.teamId;
    } else if (isNewUser) {
      const [newTeam] = await db
        .insert(teams)
        .values({ name: `${name || email}'s Team` })
        .returning();
      teamId = newTeam.id;
      await startTrial(teamId);
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

    if (teamId) {
      await db.insert(activityLogs).values({
        teamId,
        userId: user.id,
        action: isNewUser ? ActivityType.SIGN_UP : ActivityType.SIGN_IN,
      });
    }

    await setSession(user);
    return NextResponse.redirect(new URL('/sync', request.url));
  } catch (err) {
    console.error('Notion OAuth callback error:', err);
    return NextResponse.redirect(new URL('/?auth=signin&error=callback_failed', request.url));
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/notion - Initiates Notion OAuth login flow
 * Redirects to NOTION_AUTHORIZATION_URL with state for CSRF protection.
 */
export async function GET(request: NextRequest) {
  try {
    const authUrl = process.env.NOTION_AUTHORIZATION_URL;
    const clientId = process.env.NOTION_OAUTH_CLIENT_ID;

    if (!authUrl || !clientId) {
      console.error('Notion OAuth not configured: NOTION_AUTHORIZATION_URL and NOTION_OAUTH_CLIENT_ID required');
      return NextResponse.redirect(
        new URL('/?auth=signin&error=oauth_not_configured&message=Notion+login+is+not+configured', request.url)
      );
    }

    const state = crypto.randomUUID();
    const cookieStore = await cookies();
    cookieStore.set('notion_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/',
    });

    const url = new URL(authUrl);
    url.searchParams.set('state', state);

    return NextResponse.redirect(url.toString());
  } catch (error) {
    console.error('Notion OAuth initiation error:', error);
    return NextResponse.redirect(
      new URL('/?auth=signin&error=oauth_failed&message=Failed+to+start+Notion+login', request.url)
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/ado - Initiates Azure DevOps OAuth flow
 * 
 * Redirects user to Microsoft OAuth consent page.
 * After consent, user is redirected to /api/auth/ado/callback
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await getUser();
    if (!user) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    // Generate state for CSRF protection
    const state = crypto.randomUUID();
    
    // Store state in cookie for verification in callback
    const cookieStore = await cookies();
    cookieStore.set('ado_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    });

    // Azure DevOps OAuth configuration
    const clientId = process.env.AZURE_AD_CLIENT_ID;
    const redirectUri = process.env.AZURE_AD_REDIRECT_URI || 
      `${request.nextUrl.origin}/api/auth/ado/callback`;

    if (!clientId) {
      console.error('AZURE_AD_CLIENT_ID not configured');
      return NextResponse.redirect(
        new URL('/sync?error=oauth_not_configured', request.url)
      );
    }

    // Build OAuth authorization URL
    // Using Azure DevOps scope: 499b84ac-1321-427f-aa17-267ca6975798 is the Azure DevOps resource ID
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      // Request Azure DevOps API access + offline_access for refresh tokens
      scope: '499b84ac-1321-427f-aa17-267ca6975798/user_impersonation offline_access openid profile email',
      state,
      // Use 'common' for multi-tenant (any Azure AD account)
      // Use 'organizations' for work/school accounts only
    });

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('OAuth initiation error:', error);
    return NextResponse.redirect(
      new URL('/sync?error=oauth_failed', request.url)
    );
  }
}

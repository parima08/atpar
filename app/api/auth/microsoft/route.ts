import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/microsoft - Initiates Microsoft OAuth login flow
 * 
 * This is the PRIMARY login method. It:
 * 1. Authenticates the user via Microsoft
 * 2. Gets Azure DevOps API access in the same flow
 * 
 * Scopes requested:
 * - openid, profile, email: For user identity
 * - offline_access: For refresh tokens
 * - Azure DevOps user_impersonation: For ADO API access
 */
export async function GET(request: NextRequest) {
  try {
    // Get optional parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const redirect = searchParams.get('redirect') || '';
    const priceId = searchParams.get('priceId') || '';
    const inviteId = searchParams.get('inviteId') || '';

    // Generate state for CSRF protection (includes redirect info)
    const stateData = {
      csrf: crypto.randomUUID(),
      redirect,
      priceId,
      inviteId,
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');
    
    // Store state in cookie for verification in callback
    const cookieStore = await cookies();
    cookieStore.set('microsoft_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    });

    // Azure AD OAuth configuration
    const clientId = process.env.AZURE_AD_CLIENT_ID;
    // Use dedicated Microsoft redirect URI, or construct from origin
    const redirectUri = process.env.AZURE_AD_MICROSOFT_REDIRECT_URI 
      || process.env.AZURE_AD_REDIRECT_URI 
      || `${request.nextUrl.origin}/api/auth/microsoft/callback`;
    
    console.log('Microsoft OAuth redirect URI:', redirectUri);

    if (!clientId) {
      console.error('AZURE_AD_CLIENT_ID not configured');
      return NextResponse.redirect(
        new URL('/?auth=signin&error=oauth_not_configured', request.url)
      );
    }

    // Build OAuth authorization URL
    // Request both user identity scopes AND Azure DevOps API access
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      // Request user profile + Azure DevOps API access + refresh tokens
      scope: 'openid profile email offline_access 499b84ac-1321-427f-aa17-267ca6975798/user_impersonation',
      state,
      prompt: 'select_account', // Always show account picker for better UX
    });

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Microsoft OAuth initiation error:', error);
    return NextResponse.redirect(
      new URL('/?auth=signin&error=oauth_failed', request.url)
    );
  }
}

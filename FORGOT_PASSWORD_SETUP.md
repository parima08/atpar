# Forgot Password Feature Setup

## Overview
A complete "Forgot Password?" functionality has been implemented for the authentication system using Resend for email delivery.

## Files Created

### 1. **Server Action** - `lib/auth/password-reset.ts`
   - `requestPasswordReset()` - Validates email, generates reset token, sends email
   - `resetPassword()` - Validates new password and updates database
   - Token generation and hashing for security
   - 1-hour expiration window for reset links

### 2. **Components**
   - `components/auth/forgot-password-modal.tsx` - Modal for requesting password reset
   - Password reset page at `/reset-password?token=...`

### 3. **Pages**
   - `app/reset-password/page.tsx` - Password reset form with token validation

### 4. **Database**
   - Schema updated: `lib/db/schema.ts`
     - `passwordResetToken: text`
     - `passwordResetExpires: timestamp`
   - Migration: `lib/db/migrations/add-password-reset.sql`

## Files Modified

### `components/auth/auth-modal.tsx`
   - Added import for `ForgotPasswordModal`
   - Updated `SignInForm` component to include "Forgot?" link
   - Integrated forgot password modal

## Setup Instructions

### 1. Run Database Migration
```bash
# Execute the SQL migration to add new columns
npm run db:migrate
# Or manually run:
psql $POSTGRES_URL < lib/db/migrations/add-password-reset.sql
```

### 2. Environment Variables
Your `RESEND_API_KEY` should already be configured.

Set `BASE_URL` in your `.env.local`:
```
BASE_URL=http://localhost:3000  # for development
BASE_URL=https://yourdomain.com # for production
```

## User Flow

1. **Sign In Page** → User clicks "Forgot?" link next to password field
2. **Forgot Password Modal** → User enters email
3. **Email Sent** → Resend sends reset link to user's email
4. **Reset Link** → User clicks link in email
5. **Reset Password Page** → User enters new password
6. **Success** → Password updated, redirected to sign in
7. **Sign In** → User signs in with new password

## Security Features

- ✅ Tokens are hashed before storage (SHA-256)
- ✅ Tokens expire after 1 hour
- ✅ Password validation (minimum 8 characters)
- ✅ Password confirmation matching
- ✅ Hashed passwords using bcrypt
- ✅ Secure email delivery via Resend
- ✅ Email doesn't reveal if account exists (for security)

## Email Template

The reset email includes:
- Professional header with Atpar branding
- Clear call-to-action button
- Fallback link if button doesn't work
- 1-hour expiration notice
- Non-technical language

## Testing

### Test Forgot Password Flow:
1. Go to sign-in page
2. Click "Forgot?" button
3. Enter a registered email
4. Check email for reset link
5. Click link and reset password
6. Sign in with new password

### Test Invalid Token:
1. Try accessing `/reset-password?token=invalid`
2. Should show "Invalid Link" message

### Test Expired Token:
1. Wait 1 hour after requesting reset (or manually expire in DB)
2. Try to reset - should show "Invalid or expired reset link"

## Notes

- The Resend free tier uses `onboarding@resend.dev` as the sender
- To use a custom domain email (e.g., `support@yourdomain.com`), verify your domain in Resend
- Reset tokens are one-time use; requesting a new reset invalidates the old token
- Users can request multiple resets; only the latest token is valid

## Troubleshooting

**Issue: "Failed to send email"**
- Check `RESEND_API_KEY` is set correctly
- Verify Resend account is active
- Check email address is valid

**Issue: "Invalid or expired reset link"**
- Token has expired (1 hour limit)
- User should request a new reset
- Or token was already used

**Issue: Database errors**
- Run migration: `npm run db:migrate`
- Verify Postgres is running and `POSTGRES_URL` is set

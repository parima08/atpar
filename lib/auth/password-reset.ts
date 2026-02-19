'use server';

import { Resend } from 'resend';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

const requestResetSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type RequestResetInput = z.infer<typeof requestResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// Generate a reset token
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Hash the token for storage
function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function requestPasswordReset(input: RequestResetInput) {
  try {
    const validatedInput = requestResetSchema.parse(input);

    // Check if user exists
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedInput.email))
      .limit(1);

    if (!user || user.length === 0) {
      // Don't reveal if email exists for security
      return {
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      };
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const hashedToken = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // Store reset token in database (you'll need to add these fields to the users table)
    await db.execute(
      `UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE email = $3`,
      [hashedToken, expiresAt, validatedInput.email]
    );

    // Send reset email
    const resetLink = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    await resend.emails.send({
      from: 'Atpar <onboarding@resend.dev>',
      to: validatedInput.email,
      subject: 'Reset your Atpar password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0D7377;">Reset Your Password</h2>
          <p style="color: #57534E;">We received a request to reset your password. Click the button below to proceed:</p>
          <div style="margin: 32px 0;">
            <a href="${resetLink}" style="display: inline-block; background-color: #0D7377; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Reset Password
            </a>
          </div>
          <p style="color: #78716C; font-size: 14px;">
            Or copy this link: <a href="${resetLink}" style="color: #0D7377;">${resetLink}</a>
          </p>
          <p style="color: #78716C; font-size: 14px;">This link will expire in 1 hour.</p>
          <p style="color: #999; font-size: 12px; margin-top: 32px;">
            If you didn't request a password reset, please ignore this email.
          </p>
        </div>
      `,
    });

    return {
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }
    console.error('Password reset error:', error);
    return {
      success: false,
      error: 'An error occurred. Please try again later.',
    };
  }
}

export async function resetPassword(input: ResetPasswordInput) {
  try {
    const validatedInput = resetPasswordSchema.parse(input);

    const hashedToken = hashToken(validatedInput.token);

    // Find user with valid reset token
    const result = await db.execute(
      `SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()`,
      [hashedToken]
    );

    if (!result.rows || result.rows.length === 0) {
      return {
        success: false,
        error: 'Invalid or expired reset link.',
      };
    }

    const { hashPassword } = await import('@/lib/auth/session');
    const passwordHash = await hashPassword(validatedInput.password);

    // Update password and clear reset token
    await db.execute(
      `UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE password_reset_token = $2`,
      [passwordHash, hashedToken]
    );

    return {
      success: true,
      message: 'Password reset successful. You can now sign in with your new password.',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }
    console.error('Password reset error:', error);
    return {
      success: false,
      error: 'An error occurred. Please try again later.',
    };
  }
}

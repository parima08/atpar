'use server';

import { Resend } from 'resend';
import { z } from 'zod';

const resend = new Resend(process.env.RESEND_API_KEY);

const sendSupportEmailSchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000, 'Message is too long'),
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(100),
});

export type SendSupportEmailInput = z.infer<typeof sendSupportEmailSchema>;

export async function sendSupportEmail(input: SendSupportEmailInput) {
  try {
    const validatedInput = sendSupportEmailSchema.parse(input);

    const result = await resend.emails.send({
      from: 'Support <onboarding@resend.dev>',
      to: 'atpar.app@gmail.com',
      replyTo: validatedInput.email,
      subject: `New Support Message from ${validatedInput.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0D7377;">New Support Message</h2>
          <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>From:</strong> ${validatedInput.name} (${validatedInput.email})</p>
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap; color: #333;">${validatedInput.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          </div>
          <p style="color: #999; font-size: 12px;">This email was sent from the Atpar support form.</p>
        </div>
      `,
    });

    if (result.error) {
      return {
        success: false,
        error: 'Failed to send email. Please try again.',
      };
    }

    return {
      success: true,
      message: 'Thank you for reaching out! We will get back to you soon.',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }
    return {
      success: false,
      error: 'An error occurred. Please try again later.',
    };
  }
}

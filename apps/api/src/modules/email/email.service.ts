import { Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { Transporter } from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private transporter: Transporter;

  constructor() {
    // For development, use Mailhog
    // For production, use real SMTP settings
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "localhost",
      port: parseInt(process.env.SMTP_PORT || "1025"),
      secure: false, // true for 465, false for other ports
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    });
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const mailOptions = {
      from: process.env.SMTP_FROM || '"hasteCRM" <noreply@haste.nyc>',
      to: options.to,
      subject: options.subject,
      text: options.text || "",
      html: options.html,
    };

    // Attempting to send email

    try {
      await this.transporter.sendMail(mailOptions);
      // Email sent successfully
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }

  async sendVerificationEmail(
    email: string,
    verificationUrl: string,
  ): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4285f4; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #4285f4; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px;
            margin: 20px 0;
          }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to hasteCRM!</h1>
          </div>
          <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Thank you for signing up! Please click the button below to verify your email address and activate your account.</p>
            <center>
              <a href="${verificationUrl}" class="button">Verify Email</a>
            </center>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all;">${verificationUrl}</p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account with hasteCRM, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 hasteCRM. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to hasteCRM!

Please verify your email address by clicking the link below:
${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account with hasteCRM, you can safely ignore this email.

© 2025 hasteCRM. All rights reserved.
    `;

    await this.sendEmail({
      to: email,
      subject: "Verify your hasteCRM account",
      html,
      text,
    });
  }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f44336; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #f44336; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px;
            margin: 20px 0;
          }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your password. Click the button below to create a new password.</p>
            <center>
              <a href="${resetUrl}" class="button">Reset Password</a>
            </center>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all;">${resetUrl}</p>
            <p>This link will expire in 1 hour for security reasons.</p>
            <p>If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 hasteCRM. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Password Reset Request

We received a request to reset your password. Click the link below to create a new password:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.

© 2025 hasteCRM. All rights reserved.
    `;

    await this.sendEmail({
      to: email,
      subject: "Reset your hasteCRM password",
      html,
      text,
    });
  }
}

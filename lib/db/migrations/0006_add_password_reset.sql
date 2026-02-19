-- Add password reset fields to users table
ALTER TABLE users ADD COLUMN password_reset_token TEXT;
ALTER TABLE users ADD COLUMN password_reset_expires TIMESTAMP;

-- Create index for faster lookups
CREATE INDEX idx_password_reset_token ON users(password_reset_token);

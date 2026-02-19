import { db } from './drizzle';

async function migrate() {
  try {
    console.log('Running migration...');
    
    // Add columns using raw SQL through the db connection
    await db.execute`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT`;
    console.log('✓ Added password_reset_token column');
    
    await db.execute`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP`;
    console.log('✓ Added password_reset_expires column');
    
    // Create index
    await db.execute`CREATE INDEX IF NOT EXISTS idx_password_reset_token ON users(password_reset_token)`;
    console.log('✓ Created index for password_reset_token');
    
    console.log('\n✓ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();

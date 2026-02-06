/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Manually confirm a user's email
 * Usage: node scripts/confirm-user.cjs <email>
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/coach/Projects/LostCity/web/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.log('Usage: node scripts/confirm-user.cjs <email>');
    console.log('');
    console.log('Pending users:');

    const { data } = await supabase.auth.admin.listUsers({ perPage: 50 });
    const pending = data.users.filter(u => !u.email_confirmed_at);

    if (pending.length === 0) {
      console.log('  No pending users');
    } else {
      pending.forEach(u => console.log(`  - ${u.email}`));
    }
    return;
  }

  // Find user by email
  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 100 });
  const user = users.users.find(u => u.email === email);

  if (!user) {
    console.log('User not found:', email);
    return;
  }

  if (user.email_confirmed_at) {
    console.log('User already confirmed:', email);
    return;
  }

  // Confirm the user
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    email_confirm: true
  });

  if (error) {
    console.error('Error confirming user:', error.message);
    return;
  }

  console.log('✅ User confirmed:', email);
  console.log('   They can now log in at /auth/login');
}

main().catch(console.error);

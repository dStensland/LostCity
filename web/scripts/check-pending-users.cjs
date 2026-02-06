/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Check for pending (unconfirmed) users
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/coach/Projects/LostCity/web/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('=== Checking User Confirmation Status ===\n');

  // Get all users and check confirmation status
  const { data: users, error } = await supabase.auth.admin.listUsers({
    perPage: 50
  });

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  const pending = users.users.filter(u => !u.email_confirmed_at);
  const confirmed = users.users.filter(u => u.email_confirmed_at);

  console.log('Total users:', users.users.length);
  console.log('Confirmed:', confirmed.length);
  console.log('Pending (unconfirmed):', pending.length);

  if (pending.length > 0) {
    console.log('\n=== Pending Users ===');
    pending.forEach(user => {
      const created = new Date(user.created_at).toLocaleString();
      console.log(`  - ${user.email} | Created: ${created}`);
    });
  }

  // Test signup to see what happens
  console.log('\n=== Testing Signup Flow ===');
  const testEmail = `test-${Date.now()}@example.com`;
  console.log('Testing with:', testEmail);

  const { data, error: signupError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'testpassword123',
    email_confirm: false, // Don't auto-confirm
  });

  if (signupError) {
    console.log('Signup test error:', signupError.message);
  } else {
    console.log('Created test user:');
    console.log('  - ID:', data.user.id);
    console.log('  - Confirmed:', data.user.email_confirmed_at ? 'Yes' : 'No (pending)');

    // Clean up test user
    await supabase.auth.admin.deleteUser(data.user.id);
    console.log('  - Test user deleted');
  }

  // Check if we can determine email settings
  console.log('\n=== Email Configuration Check ===');
  console.log('To verify email settings, check:');
  console.log(`https://supabase.com/dashboard/project/rtppvljfrkjtoxmaizea/auth/providers`);
  console.log('');
  console.log('Look for "Email" provider settings:');
  console.log('- "Confirm email" toggle');
  console.log('- "Secure email change" toggle');
  console.log('- "Double confirm email changes" toggle');
}

main().catch(console.error);

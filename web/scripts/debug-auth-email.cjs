/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Debug Supabase Auth Email Configuration
 *
 * Run with: node scripts/debug-auth-email.cjs
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/coach/Projects/LostCity/web/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('=== Supabase Auth Email Diagnostic ===\n');

  // 1. Check environment
  console.log('1. Environment Variables:');
  console.log('   SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
  console.log('   SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
  console.log('   SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing');

  // 2. Test auth admin access
  console.log('\n2. Testing Auth Admin Access...');
  try {
    const { data: users, error } = await supabase.auth.admin.listUsers({ perPage: 1 });
    if (error) {
      console.log('   ❌ Admin access failed:', error.message);
    } else {
      console.log('   ✅ Admin access working, found', users.users.length > 0 ? 'users' : 'no users yet');
    }
  } catch (err) {
    console.log('   ❌ Admin API error:', err.message);
  }

  // 3. Check recent signups
  console.log('\n3. Recent Auth Users (last 5):');
  try {
    const { data: users } = await supabase.auth.admin.listUsers({
      perPage: 5,
      page: 1
    });

    if (users?.users?.length === 0) {
      console.log('   No users found');
    } else {
      users?.users?.forEach(user => {
        const confirmed = user.email_confirmed_at ? '✅ Confirmed' : '⏳ Pending';
        const created = new Date(user.created_at).toLocaleString();
        console.log(`   - ${user.email} | ${confirmed} | Created: ${created}`);
      });
    }
  } catch (err) {
    console.log('   Error listing users:', err.message);
  }

  // 4. Check auth settings (what we can access)
  console.log('\n4. Project Info:');
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1];
  console.log('   Project Ref:', projectRef || 'Unknown');
  console.log('   Dashboard URL:', `https://supabase.com/dashboard/project/${projectRef}/auth/providers`);

  console.log('\n=== Troubleshooting Steps ===');
  console.log('');
  console.log('1. Check Supabase Dashboard > Authentication > Providers > Email:');
  console.log('   - "Confirm email" should be ENABLED for email verification');
  console.log('   - Or DISABLED for immediate login (no email sent)');
  console.log('');
  console.log('2. Check Supabase Dashboard > Authentication > URL Configuration:');
  console.log('   - Site URL: http://localhost:3000 (or your production URL)');
  console.log('   - Redirect URLs should include: http://localhost:3000/auth/callback');
  console.log('');
  console.log('3. Check Supabase Dashboard > Authentication > Email Templates:');
  console.log('   - Verify templates are configured');
  console.log('   - Check "Confirm signup" template exists');
  console.log('');
  console.log('4. For production, configure custom SMTP:');
  console.log('   - Supabase Dashboard > Project Settings > Auth > SMTP Settings');
  console.log('   - Use Resend, SendGrid, or your email provider');
  console.log('');
  console.log('5. Check spam folder - Supabase emails often end up there');
  console.log('');
  console.log('6. Rate limits: Supabase built-in email is limited to ~4 emails/hour');
  console.log('   If you\'ve been testing, you may have hit the limit');
}

main().catch(console.error);

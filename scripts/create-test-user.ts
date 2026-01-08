
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestUser() {
    const email = 'test@dorannurseries.com';
    const password = 'password123';

    console.log(`Creating/Finding user ${email}...`);

    // 1. Get Org
    const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .select('id')
        .ilike('name', 'Doran Nurseries')
        .single();

    if (orgErr || !org) {
        console.error('Org verification failed', orgErr);
        // Fallback to any org
        const { data: anyOrg } = await supabase.from('organizations').select('id').limit(1).single();
        if (!anyOrg) throw new Error("No orgs found");
        console.log("Using fallback org", anyOrg.id);
    } else {
        console.log("Found Org:", org.id);
    }

    // 2. Create User
    const { data: { users } } = await supabase.auth.admin.listUsers();
    let user = users.find(u => u.email === email);

    if (!user) {
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: 'Test Manager' }
        });
        if (createError) throw createError;
        user = newUser.user;
        console.log('User created');
    } else {
        console.log('User already exists:', user.id);
        // Reset password to be sure
        await supabase.auth.admin.updateUserById(user.id, { password: password });
        console.log('Password reset');
    }

    if (!user) throw new Error("User creation failed");

    // 3. Link to Org
    const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({
            id: user.id,
            email: email,
            active_org_id: org.id,
            display_name: 'Test Manager'
        });
    if (profileErr) console.error('Profile upsert error', profileErr);

    const { error: memberErr } = await supabase
        .from('org_memberships')
        .upsert({
            org_id: org.id,
            user_id: user.id,
            role: 'admin'
        });
    if (memberErr) console.error('Member upsert error', memberErr);

    console.log('User setup complete.');
    console.log('Email:', email);
    console.log('Password:', password);
}

createTestUser().catch(console.error);

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Ensure we use the service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  try {
    console.log('--- B2B User Setup Tool ---');
    console.log('This tool links a Supabase Auth user to a B2B Customer account.\n');

    // 1. Fetch Customers
    // Explicitly use the service role client for all operations
    const { data: customers, error: custError } = await supabase
      .from('customers')
      .select('id, name')
      .order('name');

    if (custError) throw new Error(`Failed to fetch customers: ${custError.message}`);
    if (!customers || customers.length === 0) {
      console.log('No customers found in database. Please seed data first.');
      process.exit(0);
    }

    console.log('Available Customers:');
    customers.forEach((c, idx) => {
      console.log(`${idx + 1}. ${c.name} (${c.id})`);
    });
    console.log('');

    // 2. Select Customer
    let customerId = '';
    while (!customerId) {
      const answer = await askQuestion('Select customer (number): ');
      const index = parseInt(answer) - 1;
      if (index >= 0 && index < customers.length) {
        customerId = customers[index].id;
        console.log(`Selected: ${customers[index].name}\n`);
      } else {
        console.log('Invalid selection.');
      }
    }

    // 2.5. Select Store/Address (optional for store-level access)
    let customerAddressId: string | null = null;

    const { data: addresses, error: addrError } = await supabase
      .from('customer_addresses')
      .select('id, label, store_name, line1, city')
      .eq('customer_id', customerId)
      .order('label');

    if (addrError) {
      console.warn(`Warning: Could not fetch addresses: ${addrError.message}`);
    } else if (addresses && addresses.length > 0) {
      console.log('\nAvailable Stores/Addresses:');
      console.log('0. Head Office (access to ALL stores)');
      addresses.forEach((a, idx) => {
        const name = a.label || a.store_name || `${a.line1}, ${a.city}`;
        console.log(`${idx + 1}. ${name}`);
      });
      console.log('');

      const addrAnswer = await askQuestion('Select store (0 for head office, or number): ');
      const addrIndex = parseInt(addrAnswer);

      if (addrIndex > 0 && addrIndex <= addresses.length) {
        customerAddressId = addresses[addrIndex - 1].id;
        const addrName = addresses[addrIndex - 1].label || addresses[addrIndex - 1].store_name || 'Address';
        console.log(`Selected: ${addrName} (store-level access)\n`);
      } else {
        console.log('Selected: Head Office (full access to all stores)\n');
      }
    } else {
      console.log('\nNo addresses found for this customer (user will have full access).\n');
    }

    // 3. Enter User Email
    const email = await askQuestion('Enter user email address: ');
    if (!email) {
      console.error('Email is required.');
      process.exit(1);
    }

    // 4. Find User in Auth
    console.log(`\nLooking up user ${email}...`);
    
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) throw new Error(`Auth error: ${authError.message}`);
    
    let user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      console.log('User not found.');
      const create = await askQuestion('Create new user? (y/n): ');
      if (create.toLowerCase() === 'y') {
        const password = await askQuestion('Enter password: ');
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: email.split('@')[0]
          }
        });
        
        if (createError) throw new Error(`Failed to create user: ${createError.message}`);
        user = newUser.user;
        console.log(`User created (ID: ${user.id})`);
      } else {
        console.log('Aborting.');
        process.exit(0);
      }
    } else {
      console.log(`User found (ID: ${user.id})`);
    }

    if (!user) throw new Error("Unexpected state: no user");

    // 5. Update Profile
    console.log(`\nUpdating profile for user ${user.id}...`);
    
    // Check if profile exists
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    
    if (!profile) {
      console.log('Profile does not exist. Creating...');
      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        email: email,
        portal_role: 'customer',
        customer_id: customerId,
        customer_address_id: customerAddressId,
      });
      if (insertError) throw new Error(`Failed to create profile: ${insertError.message}`);
    } else {
      console.log('Profile exists. Updating role and customer link...');
      const { error: updateError } = await supabase.from('profiles').update({
        portal_role: 'customer',
        customer_id: customerId,
        customer_address_id: customerAddressId,
      }).eq('id', user.id);

      if (updateError) throw new Error(`Failed to update profile: ${updateError.message}`);
    }

    // Get selected address name for display
    const selectedAddressName = customerAddressId
      ? addresses?.find(a => a.id === customerAddressId)?.label ||
        addresses?.find(a => a.id === customerAddressId)?.store_name ||
        'Store'
      : null;

    console.log('\n✅ Success! User linked to customer.');
    console.log(`Email: ${email}`);
    console.log(`Role: customer`);
    console.log(`Customer: ${customers.find(c => c.id === customerId)?.name}`);
    if (selectedAddressName) {
      console.log(`Store: ${selectedAddressName} (store-level access)`);
    } else {
      console.log(`Access: Head Office (full access to all stores)`);
    }
    console.log('\nYou can now log in at /b2b/login with this user.');

  } catch (err: any) {
    console.error('\n❌ Error:', err.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();

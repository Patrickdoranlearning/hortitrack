import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
    console.log('Seeding data...');

    // 1. Organization
    const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .upsert({ name: 'Doran Nurseries', country_code: 'IE' }, { onConflict: 'name' })
        .select()
        .single();

    if (orgErr) throw new Error(`Org seed failed: ${orgErr.message}`);
    console.log(`Organization: ${org.name} (${org.id})`);

    // 2. Site
    const { data: site, error: siteErr } = await supabase
        .from('sites')
        .upsert({ org_id: org.id, name: 'Main Site' }, { onConflict: 'name' }) // Note: name is not unique in schema, but good enough for seed
        .select() // If not unique constraint, upsert might duplicate. Schema says name is NOT unique globally, but maybe per org?
        // Actually schema says: name text NOT NULL. No unique constraint on sites(name).
        // So upsert might fail or duplicate.
        // I'll check if exists first or just insert if empty.
        // For now, I'll assume empty or just insert.
        // Wait, I should be careful.
        // Let's check if site exists.
        .limit(1)
        .maybeSingle(); // upsert without onConflict works on PK.
    // I'll use select and then insert if not found.

    let siteId;
    const { data: existingSite } = await supabase.from('sites').select('id').eq('name', 'Main Site').eq('org_id', org.id).single();
    if (existingSite) {
        siteId = existingSite.id;
    } else {
        const { data: newSite } = await supabase.from('sites').insert({ org_id: org.id, name: 'Main Site' }).select().single();
        siteId = newSite.id;
    }
    console.log(`Site: Main Site (${siteId})`);

    // 3. Locations
    const locations = ['Tunnel 1', 'Tunnel 2', 'Field A', 'Glasshouse'];
    for (const loc of locations) {
        const { data: existing } = await supabase.from('nursery_locations').select('id').eq('name', loc).eq('org_id', org.id).single();
        if (!existing) {
            await supabase.from('nursery_locations').insert({ org_id: org.id, site_id: siteId, name: loc, nursery_site: 'Main Site' });
        }
    }
    console.log('Locations seeded');

    // 4. Plant Sizes
    const sizes = [
        { name: '9cm', container_type: 'pot', cell_multiple: 1 },
        { name: '2L', container_type: 'pot', cell_multiple: 1 },
        { name: '3L', container_type: 'pot', cell_multiple: 1 },
        { name: 'Tray 104', container_type: 'tray', cell_multiple: 104 },
    ];
    for (const s of sizes) {
        // Check by name (assuming global or we don't care about dupes for now, but better to check)
        // Schema: plant_sizes(name) is not unique.
        const { data: existing } = await supabase.from('plant_sizes').select('id').eq('name', s.name).single();
        if (!existing) {
            await supabase.from('plant_sizes').insert(s);
        }
    }
    console.log('Sizes seeded');

    // 5. Plant Varieties
    const varieties = [
        { name: 'Lavandula angustifolia', family: 'Lamiaceae', genus: 'Lavandula', species: 'angustifolia' },
        { name: 'Rosmarinus officinalis', family: 'Lamiaceae', genus: 'Salvia', species: 'rosmarinus' },
        { name: 'Hydrangea macrophylla', family: 'Hydrangeaceae', genus: 'Hydrangea', species: 'macrophylla' },
    ];
    for (const v of varieties) {
        const { data: existing } = await supabase.from('plant_varieties').select('id').eq('name', v.name).single();
        if (!existing) {
            await supabase.from('plant_varieties').insert(v);
        }
    }
    console.log('Varieties seeded');

    // 6. Suppliers
    const suppliers = [
        { name: 'Seed Supplier A', country_code: 'NL' },
        { name: 'Young Plants B', country_code: 'IE' },
    ];
    for (const s of suppliers) {
        const { data: existing } = await supabase.from('suppliers').select('id').eq('name', s.name).eq('org_id', org.id).single();
        if (!existing) {
            await supabase.from('suppliers').insert({ ...s, org_id: org.id });
        }
    }
    console.log('Suppliers seeded');

    // 7. Customers
    const customers = [
        { name: 'Garden Center X', email: 'buyer@gcx.com' },
        { name: 'Landscaper Y', email: 'info@landscapery.com' },
    ];
    for (const c of customers) {
        const { data: existing } = await supabase.from('customers').select('id').eq('name', c.name).eq('org_id', org.id).single();
        if (!existing) {
            await supabase.from('customers').insert({ ...c, org_id: org.id });
        }
    }
    console.log('Customers seeded');

    // 8. SKUs (Variety + Size)
    // Fetch all varieties and sizes
    const { data: allVarieties } = await supabase.from('plant_varieties').select('id, name');
    const { data: allSizes } = await supabase.from('plant_sizes').select('id, name');

    if (allVarieties && allSizes) {
        for (const v of allVarieties) {
            for (const s of allSizes) {
                const code = `${v.name.substring(0, 3).toUpperCase()}-${s.name}`;
                const { data: existing } = await supabase.from('skus').select('id').eq('code', code).eq('org_id', org.id).single();
                if (!existing) {
                    await supabase.from('skus').insert({
                        org_id: org.id,
                        code,
                        plant_variety_id: v.id,
                        size_id: s.id,
                        description: `${v.name} in ${s.name}`,
                        default_vat_rate: 13.5
                    });
                }
            }
        }
    }
    console.log('SKUs seeded');

    console.log('Seeding complete!');
}

seed().catch(e => {
    console.error(e);
    process.exit(1);
});

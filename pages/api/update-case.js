import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS — this allows associates to update
// any case they have access to, not just cases assigned directly to them.
// Authentication is still verified via the user's session token.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { caseId, updates, userToken } = req.body;

  if (!caseId || !updates || !userToken) {
    return res.status(400).json({ error: 'Missing required fields: caseId, updates, userToken' });
  }

  // Verify the user is authenticated by checking their token
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${userToken}` } } }
  );

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify the user is a partner or associate (not a public user)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: 'User profile not found' });
  }

  if (!['partner', 'associate'].includes(profile.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // Sanitize updates — only allow safe fields to be updated
  const allowedFields = [
    'client_name', 'client_contact', 'case_type', 'file_number', 'file_type',
    'status', 'is_public', 'is_starred', 'opposing_party', 'court_name',
    'court_case_number', 'description', 'notes', 'assigned_to',
    'next_hearing_date', 'updated_at'
  ];

  const sanitizedUpdates = {};
  for (const key of allowedFields) {
    if (key in updates) {
      sanitizedUpdates[key] = updates[key];
    }
  }

  // Partners can also update sensitive fields
  if (profile.role === 'partner') {
    const partnerOnlyFields = ['is_archived', 'billing_status', 'retainer_amount'];
    for (const key of partnerOnlyFields) {
      if (key in updates) {
        sanitizedUpdates[key] = updates[key];
      }
    }
  }

  // Always set updated_at
  sanitizedUpdates.updated_at = new Date().toISOString();

  // Perform the update using service role (bypasses RLS)
  const { data, error } = await supabaseAdmin
    .from('cases')
    .update(sanitizedUpdates)
    .eq('id', caseId)
    .select()
    .single();

  if (error) {
    console.error('Case update error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, data });
}

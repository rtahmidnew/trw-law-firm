import { createClient } from '@supabase/supabase-js';

// Service role client — bypasses RLS for all operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Verify the requesting user is an authenticated partner or associate
async function verifyUser(userToken) {
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${userToken}` } } }
  );
  const { data: { user }, error } = await supabaseUser.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['partner', 'associate'].includes(profile.role)) return null;
  return { user, profile };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, userToken, ...params } = req.body;

  if (!userToken) {
    return res.status(400).json({ error: 'Missing userToken' });
  }

  const verified = await verifyUser(userToken);
  if (!verified) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── DELETE CASE ──────────────────────────────────────────────
  if (action === 'delete_case') {
    const { caseId } = params;
    if (!caseId) return res.status(400).json({ error: 'Missing caseId' });

    // Delete all storage files first
    const { data: docs } = await supabaseAdmin
      .from('documents')
      .select('file_path')
      .eq('case_id', caseId);

    if (docs && docs.length > 0) {
      const paths = docs.map(d => d.file_path);
      await supabaseAdmin.storage.from('case-documents').remove(paths);
    }

    // Delete the case (cascades to timeline_entries, documents, deadlines via DB constraints)
    const { error } = await supabaseAdmin
      .from('cases')
      .delete()
      .eq('id', caseId);

    if (error) {
      console.error('Delete case error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  }

  // ── DELETE DOCUMENT ──────────────────────────────────────────
  if (action === 'delete_document') {
    const { docId, filePath } = params;
    if (!docId || !filePath) return res.status(400).json({ error: 'Missing docId or filePath' });

    await supabaseAdmin.storage.from('case-documents').remove([filePath]);
    const { error } = await supabaseAdmin.from('documents').delete().eq('id', docId);

    if (error) {
      console.error('Delete document error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  }

  // ── INSERT DOCUMENT RECORD (after client-side upload) ────────
  if (action === 'insert_document') {
    const { caseId, userId, fileName, filePath, fileType, fileSize } = params;
    if (!caseId || !fileName || !filePath) {
      return res.status(400).json({ error: 'Missing required document fields' });
    }

    const { data, error } = await supabaseAdmin
      .from('documents')
      .insert({
        case_id: caseId,
        user_id: userId,
        file_name: fileName,
        file_path: filePath,
        file_type: fileType,
        file_size: fileSize,
      })
      .select()
      .single();

    if (error) {
      console.error('Insert document error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, data });
  }

  // ── GET UPLOAD URL (signed upload URL for storage) ───────────
  if (action === 'get_upload_url') {
    const { filePath } = params;
    if (!filePath) return res.status(400).json({ error: 'Missing filePath' });

    const { data, error } = await supabaseAdmin.storage
      .from('case-documents')
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error('Signed upload URL error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, signedUrl: data.signedUrl, token: data.token });
  }

  // ── GET SIGNED DOWNLOAD URL ──────────────────────────────────
  if (action === 'get_signed_url') {
    const { filePath, expiresIn = 300 } = params;
    if (!filePath) return res.status(400).json({ error: 'Missing filePath' });

    const { data, error } = await supabaseAdmin.storage
      .from('case-documents')
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Signed URL error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, signedUrl: data.signedUrl });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

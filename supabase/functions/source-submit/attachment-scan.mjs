// Connect only to a newsroom-controlled private scanner; never a public file service.
export async function scanAttachment(file, { url = '', token = '', required = false, fetcher = fetch, cryptoImpl = crypto } = {}) {
  if (!url && !token && !required) return 'not_configured';
  let endpoint;
  try { endpoint = new URL(url); } catch { throw new Error('attachment_scan_unavailable'); }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || !token) throw new Error('attachment_scan_unavailable');
  const bytes = await file.arrayBuffer();
  const digest = await cryptoImpl.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
  try {
    const response = await fetcher(endpoint.href, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream', 'X-Content-SHA256': hash },
      body: bytes
    });
    if (!response.ok) throw new Error('attachment_scan_unavailable');
    const result = await response.json();
    if (result.sha256 !== hash) throw new Error('attachment_scan_unavailable');
    if (result.verdict === 'infected') throw new Error('attachment_rejected');
    if (result.verdict !== 'clean') throw new Error('attachment_scan_unavailable');
    return 'clean';
  } catch (error) {
    if (error?.message === 'attachment_rejected') throw error;
    throw new Error('attachment_scan_unavailable');
  }
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useSession } from '../session';

type Preview = { preview_id: string; counts: Record<string, number>; original_bytes: number; confirmation: string; expires_at: string };
export default function CleanupPage() {
  const { user, loading } = useSession();
  const [options, setOptions] = useState({ reports: false, uploads: false, accounts: false });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const status = useQuery({ queryKey: ['cleanup-storage'], queryFn: () => api<{jobs: Record<string, number>}>('/admin/cleanup/storage-status'), enabled: user?.role === 'admin', refetchInterval: 10000 });
  if (loading) return <div className="wf-page">Loading…</div>;
  if (user?.role !== 'admin') return <div className="wf-page"><h1>Administrator access required</h1><p>Database cleanup is restricted to platform administrators.</p><Link to="/login">Sign in</Link></div>;
  const run = async (execute: boolean) => {
    setBusy(true); setMessage('');
    try {
      if (execute && preview) {
        const result = await api<{message: string}>('/admin/cleanup/execute', {method: 'POST', body: JSON.stringify({preview_id: preview.preview_id, confirmation})});
        setMessage(result.message); setPreview(null); setConfirmation(''); await status.refetch();
      } else {
        setPreview(await api<Preview>('/admin/cleanup/preview', {method: 'POST', body: JSON.stringify(options)})); setConfirmation('');
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Cleanup failed.'); }
    finally { setBusy(false); }
  };
  return <div className="wf-page"><h1>Prototype data cleanup</h1><section className="wf-panel">
    <p>Water bodies, authority directory, monitoring datasets and administrator accounts are preserved. Download any records you need before deleting them. Deletion cannot be undone.</p>
    <p>Account cleanup removes citizen accounts without organisation memberships. Organisation staff are preserved. Browser drafts on other devices are not cleared.</p>
    {(['reports', 'uploads', 'accounts'] as const).map(key => <label key={key} style={{display:'block', padding:'12px 0'}}><input type="checkbox" checked={options[key]} disabled={busy} onChange={e => { const checked = e.target.checked; setOptions(old => ({...old, [key]: checked, ...(key === 'reports' && checked ? {uploads:true} : {}), ...(key === 'accounts' && checked ? {reports:true, uploads:true} : {})})); setPreview(null); setConfirmation(''); }} /> {key === 'reports' ? 'Delete reports, incidents and their response history' : key === 'uploads' ? 'Delete uploaded evidence and stored files' : 'Delete citizen accounts and their login sessions'}</label>)}
    <button type="button" disabled={busy || !Object.values(options).some(Boolean)} onClick={() => run(false)}>Preview cleanup</button>
    {preview && <section aria-label="Cleanup preview"><h2>Review deletion counts</h2><ul>{Object.entries(preview.counts).map(([key,value]) => <li key={key}>{key}: {value}</li>)}</ul><p>Original uploads: {(preview.original_bytes / 1048576).toFixed(2)} MB. Storage also includes processed copies. Preview expires in 10 minutes.</p><label>Type DELETE PROTOTYPE DATA to confirm<input value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)} autoComplete="off" /></label><button type="button" disabled={busy || confirmation !== preview.confirmation} onClick={() => run(true)}>{busy ? 'Working…' : 'Permanently delete selected data'}</button></section>}
    {message && <p role="status">{message}</p>}
    <p>Storage deletion jobs: {status.data ? Object.entries(status.data.jobs).map(([key,value]) => `${key}: ${value}`).join(', ') || 'none' : 'Loading…'}</p>
    {!!status.data?.jobs.failed && <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await api('/admin/cleanup/retry-storage', {method:'POST'}); await status.refetch(); setMessage('Failed storage deletions queued for retry.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Retry failed.'); } finally { setBusy(false); } }}>Retry failed file deletions</button>}
    {status.error && <p role="alert">Unable to load storage deletion status. Refresh this page.</p>}
  </section></div>;
}

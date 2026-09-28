import { Link, Outlet, createFileRoute, useLocation } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ChevronRight, UserPlus } from 'lucide-react';
import { AppHeader, PageShell } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/integrations/supabase/types';

export const Route = createFileRoute('/_authenticated/instructor')({
  head: () => ({ meta: [
    { title: 'Instructor dashboard — CTC Bot' },
    { name: 'description', content: 'Review student case sessions, recordings, transcripts and warnings.' },
    { property: 'og:title', content: 'Instructor dashboard — CTC Bot' },
    { property: 'og:description', content: 'Review student case sessions, recordings, transcripts and warnings.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }), component: InstructorPage,
});

type Session = Tables<'sessions'>;
type Profile = Tables<'profiles'>;
function InstructorPage() {
  const location = useLocation();
  return location.pathname === '/instructor' ? <InstructorDashboard /> : <Outlet />;
}
function InstructorDashboard() {
  const { isInstructor, loading } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!isInstructor) return;
    let live = true;
    (async () => {
      const { data, error: fetchError } = await supabase.from('sessions').select('*').order('started_at', { ascending: false });
      if (!live) return;
      if (fetchError) { setError(fetchError.message); return; }
      setSessions(data ?? []);
      const ids = [...new Set((data ?? []).map(s => s.student_id))];
      if (ids.length) {
        const result = await supabase.from('profiles').select('*').in('id', ids);
        if (!live) return;
        if (result.error) setError(result.error.message);
        else setProfiles(Object.fromEntries((result.data ?? []).map(p => [p.id, p])));
      }
    })();
    return () => { live = false; };
  }, [isInstructor]);
  async function promote(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(''); setError('');
    const { data, error: promoteError } = await supabase.rpc('promote_to_instructor', { _email: email.trim() });
    if (promoteError) setError(promoteError.message);
    else if (!data) setError('No account found with that email. Ask them to sign up first.');
    else { setMessage('Instructor access granted.'); setEmail(''); }
    setBusy(false);
  }
  return <PageShell><AppHeader /><div className="mb-8 border-b border-border pb-6"><p className="font-mono text-xs uppercase text-primary">Instructor / Overview</p><h1 className="mt-2 font-display text-4xl font-bold">Student sessions</h1><p className="mt-2 text-sm text-muted-foreground">Review each student's reasoning and the recording alongside flagged moments.</p></div>
    {loading ? <p className="text-muted-foreground">Loading…</p> : !isInstructor ? <div role="alert" className="border-l-2 border-destructive p-5 text-sm">Instructor access is required for this page.</div> : <>
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b border-border font-mono text-[11px] uppercase text-muted-foreground"><tr><th className="py-3 pr-4 font-normal">Case</th><th className="py-3 pr-4 font-normal">Student</th><th className="py-3 pr-4 font-normal">Date</th><th className="py-3 pr-4 font-normal">Status</th><th className="py-3 pr-4 font-normal">Warnings</th><th className="py-3 font-normal">Review</th></tr></thead><tbody>{sessions.map(s => <tr key={s.id} className="border-b border-border"><td className="py-4 pr-4 font-medium">{s.case_name}</td><td className="py-4 pr-4 text-muted-foreground">{profiles[s.student_id]?.display_name || profiles[s.student_id]?.email || 'Student'}</td><td className="py-4 pr-4 text-muted-foreground">{new Date(s.started_at).toLocaleString()}</td><td className="py-4 pr-4 capitalize">{s.status}</td><td className="py-4 pr-4">{s.flag_count}</td><td className="py-4"><Button asChild size="sm" variant="ghost"><Link to="/instructor/$sessionId" params={{ sessionId: s.id }} aria-label={`Review ${s.case_name}`}><ChevronRight /></Link></Button></td></tr>)}</tbody></table>{!sessions.length && <p className="py-10 text-center text-sm text-muted-foreground">No student sessions yet.</p>}</div>
      <section className="mt-14 max-w-xl border-t border-border pt-8"><h2 className="font-display text-2xl font-semibold">Grant instructor access</h2><p className="mt-2 text-sm text-muted-foreground">The person must already have a CTC Bot account.</p><form onSubmit={promote} className="mt-4 flex flex-wrap gap-2"><input type="email" required aria-label="Account email" placeholder="Account email" value={email} onChange={e => setEmail(e.target.value)} className="min-w-[220px] flex-1 border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" /><Button disabled={busy} type="submit"><UserPlus /> Grant access</Button></form>{message && <p role="status" className="mt-3 text-sm text-primary">{message}</p>}</section>
    </>}
  </PageShell>;
}

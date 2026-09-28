import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { AppHeader, PageShell } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/integrations/supabase/types';

export const Route = createFileRoute('/_authenticated/instructor/$sessionId')({
  head: () => ({ meta: [
    { title: 'Session review — CTC Bot' },
    { name: 'description', content: 'Instructor review of a case discussion, recording, transcript and warnings.' },
    { property: 'og:title', content: 'Session review — CTC Bot' },
    { property: 'og:description', content: 'Instructor review of a case discussion, recording, transcript and warnings.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }), component: ReviewPage,
});
function ReviewPage() {
  const { sessionId } = Route.useParams();
  const { isInstructor, loading } = useAuth();
  const [session, setSession] = useState<Tables<'sessions'> | null>(null);
  const [student, setStudent] = useState<Tables<'profiles'> | null>(null);
  const [turns, setTurns] = useState<Tables<'session_turns'>[]>([]);
  const [flags, setFlags] = useState<Tables<'session_flags'>[]>([]);
  const [video, setVideo] = useState('');
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(true);
  useEffect(() => {
    if (!isInstructor) return;
    let live = true;
    (async () => {
      const { data, error: sessionError } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
      if (!live) return;
      if (sessionError || !data) { setError(sessionError?.message ?? 'Session not found.'); setFetching(false); return; }
      setSession(data);
      const [p, t, f] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', data.student_id).maybeSingle(),
        supabase.from('session_turns').select('*').eq('session_id', sessionId).order('idx'),
        supabase.from('session_flags').select('*').eq('session_id', sessionId).order('at'),
      ]);
      if (!live) return;
      setStudent(p.data); setTurns(t.data ?? []); setFlags(f.data ?? []);
      if (p.error || t.error || f.error) setError(p.error?.message ?? t.error?.message ?? f.error?.message ?? 'Could not load review.');
      if (data.recording_path) {
        const signed = await supabase.storage.from('recordings').createSignedUrl(data.recording_path, 3600);
        if (!live) return;
        if (signed.error) setError(signed.error.message);
        else setVideo(signed.data.signedUrl);
      }
      setFetching(false);
    })();
    return () => { live = false; };
  }, [isInstructor, sessionId]);
  return <PageShell><AppHeader /><Button variant="ghost" asChild className="mb-5"><Link to="/instructor"><ArrowLeft /> All sessions</Link></Button>
    {loading || (isInstructor && fetching) ? <p className="text-sm text-muted-foreground">Loading review…</p> : !isInstructor ? <p role="alert" className="text-sm text-destructive">Instructor access is required.</p> : <>
      {error && <p role="alert" className="mb-5 border-l-2 border-destructive p-3 text-sm text-destructive">{error}</p>}
      {session && <><div className="mb-8 border-b border-border pb-6"><p className="font-mono text-xs uppercase text-primary">Session review / {session.status}</p><h1 className="mt-2 font-display text-4xl font-bold">{session.case_name}</h1><p className="mt-2 text-sm text-muted-foreground">{student?.display_name || student?.email || 'Student'} · {new Date(session.started_at).toLocaleString()} · {flags.length} warnings</p></div>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="min-w-0 space-y-10"><section><h2 className="mb-4 font-display text-2xl font-semibold">Recording</h2>{video ? <video src={video} controls playsInline className="aspect-video w-full bg-foreground" /> : <p className="border border-border p-5 text-sm text-muted-foreground">{session.status === 'completed' ? 'Recording unavailable.' : 'Recording will appear after the student finishes.'}</p>}</section>
        <section><h2 className="mb-4 font-display text-2xl font-semibold">Transcript</h2><div className="space-y-4">{turns.map(t => <div key={t.id} className={`border-l-2 px-4 py-3 text-sm leading-relaxed ${t.role === 'probe' ? 'border-primary bg-accent/60' : 'border-foreground bg-secondary'}`}><span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">{t.role === 'probe' ? 'CTC Bot' : 'Student'}</span>{t.content}</div>)}{!turns.length && <p className="text-sm text-muted-foreground">No turns recorded yet.</p>}</div></section></div>
        <aside><h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-semibold"><AlertTriangle className="size-5" /> Warnings</h2>{flags.length ? <ol className="border-l border-border pl-5">{flags.map(f => <li key={f.id} className="relative mb-6 text-sm before:absolute before:-left-[25px] before:top-1 before:size-2 before:rounded-full before:bg-primary"><span className="font-mono text-xs text-muted-foreground">{f.offset_seconds == null ? new Date(f.at).toLocaleTimeString() : `${Math.floor(f.offset_seconds / 60)}:${String(f.offset_seconds % 60).padStart(2, '0')}`}</span><p className="mt-1">{f.detail || f.type}</p></li>)}</ol> : <p className="text-sm text-muted-foreground">No warnings recorded.</p>}<p className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">Automated face checks are signals, not proof of misconduct. Review the recording before drawing conclusions.</p></aside></div>
      </>}
    </>}
  </PageShell>;
}

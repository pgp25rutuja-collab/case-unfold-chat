import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, Download, Mic, MicOff, Play, RotateCcw, Send, Square } from 'lucide-react';
import { AppHeader, PageShell } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { askProbe } from '@/lib/probe.functions';
import { extractText } from '@/lib/extract-text';
import { countFaces } from '@/lib/face-watch';
import { SessionMedia } from '@/lib/session-media';
import { speak, transcribe } from '@/lib/voice-client';

export const Route = createFileRoute('/_authenticated/session')({
  head: () => ({ meta: [
    { title: 'Student session — CTC Bot' },
    { name: 'description', content: 'Record and complete five spoken case-study questions with CTC Bot.' },
    { property: 'og:title', content: 'Student session — CTC Bot' },
    { property: 'og:description', content: 'Record and complete five spoken case-study questions with CTC Bot.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }), component: SessionPage,
});

type Turn = { role: 'probe' | 'student'; content: string };
type Flag = { type: string; detail: string; offset_seconds: number };

function SessionPage() {
  const [fileName, setFileName] = useState('');
  const [caseText, setCaseText] = useState('');
  const [phase, setPhase] = useState<'upload' | 'check' | 'session' | 'finished'>('upload');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [recordingAnswer, setRecordingAnswer] = useState(false);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [sessionId, setSessionId] = useState('');
  const media = useRef<SessionMedia | null>(null);
  const preview = useRef<HTMLVideoElement>(null);
  const answerRecorder = useRef<MediaRecorder | null>(null);
  const answerChunks = useRef<Blob[]>([]);
  const answerStart = useRef(0);
  const started = useRef(0);
  const sessionIdRef = useRef('');
  const flagsRef = useRef<Flag[]>([]);
  const turnsRef = useRef<Turn[]>([]);
  const pauseRef = useRef(false);
  const busyRef = useRef(false);
  const flagCooldown = useRef<Record<string, number>>({});

  const setBusyState = (value: boolean) => { busyRef.current = value; setBusy(value); };
  const setPause = useCallback((value: boolean) => {
    pauseRef.current = value;
    setPaused(value);
    if (value) media.current?.pause(); else media.current?.resume();
  }, []);
  const flag = useCallback(async (type: string, detail: string) => {
    const id = sessionIdRef.current;
    if (!id || Date.now() - (flagCooldown.current[type] ?? 0) < 10000) return;
    flagCooldown.current[type] = Date.now();
    const entry = { type, detail, offset_seconds: Math.floor((Date.now() - started.current) / 1000) };
    flagsRef.current = [...flagsRef.current, entry];
    setFlags(flagsRef.current);
    const { error } = await supabase.from('session_flags').insert({ session_id: id, ...entry });
    if (error) setError(`Warning could not be saved: ${error.message}`);
  }, []);
  const storeTurn = async (turn: Turn) => {
    const id = sessionIdRef.current;
    const idx = turnsRef.current.length;
    if (!id) throw new Error('Session was not started.');
    const { error } = await supabase.from('session_turns').insert({ session_id: id, idx, ...turn });
    if (error) throw error;
    turnsRef.current = [...turnsRef.current, turn];
    setTurns(turnsRef.current);
  };

  useEffect(() => () => {
    answerRecorder.current?.state === 'recording' && answerRecorder.current.stop();
    void media.current?.dispose();
  }, []);
  useEffect(() => {
    if (phase !== 'session') return;
    const visibility = () => { if (document.hidden) void flag('tab_hidden', 'Student left the tab.'); };
    const blur = () => { if (!document.hidden) void flag('window_blur', 'Student left the window.'); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    let missing = 0;
    let multiple = 0;
    const interval = window.setInterval(async () => {
      const device = media.current;
      if (!device?.healthy) {
        if (!pauseRef.current) {
          setPause(true);
          setStatus('Camera or microphone disconnected. Reconnect both to continue.');
          void flag('device_off', 'Camera or microphone disconnected.');
        }
        return;
      }
      if (pauseRef.current && !document.hidden) {
        setPause(false);
        setStatus('Devices restored. Continue when ready.');
      }
      const count = await countFaces(device.preview);
      missing = count === 0 ? missing + 1 : 0;
      multiple = count !== null && count > 1 ? multiple + 1 : 0;
      if (missing === 3) void flag('no_face', 'No face visible for at least six seconds.');
      if (multiple === 2) void flag('multiple_faces', 'More than one face visible.');
    }, 2000);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
      clearInterval(interval);
    };
  }, [phase, flag, setPause]);

  async function chooseFile(file?: File) {
    if (!file) return;
    setError(''); setBusyState(true);
    try {
      if (!/\.(pdf|docx|txt)$/i.test(file.name)) throw new Error('Choose a PDF, Word (.docx) or text file.');
      const text = (await extractText(file)).trim();
      if (text.length < 200) throw new Error('This file has too little readable case text.');
      setCaseText(text); setFileName(file.name); setPhase('check');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read the case.'); }
    finally { setBusyState(false); }
  }
  async function connect() {
    setBusyState(true); setError('');
    try {
      if (!media.current) media.current = new SessionMedia();
      media.current.onDisconnect = () => {
        if (sessionIdRef.current) { setPause(true); setStatus('Camera or microphone disconnected. Reconnect both to continue.'); void flag('device_off', 'Camera or microphone disconnected.'); }
      };
      await media.current.connect();
      if (preview.current) { preview.current.srcObject = media.current.preview.srcObject; await preview.current.play(); }
      setStatus('Camera and microphone ready.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Allow camera and microphone access to continue.'); }
    finally { setBusyState(false); }
  }
  async function nextQuestion(history: Turn[], number: number) {
    setBusyState(true); setError(''); setStatus('Preparing the next question…');
    try {
      const result = await askProbe({ data: { caseText, history, turn: number, total: 5 } });
      if (!result.text) throw new Error('No question was returned. Try again.');
      await storeTurn({ role: 'probe', content: result.text });
      if (result.closing) { await finish(); return; }
      setStatus('CTC Bot is speaking…');
      await speak(result.text);
      setStatus('Ready for your answer.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the question.'); setStatus('Question is shown above; you can continue.'); }
    finally { setBusyState(false); }
  }
  async function start() {
    if (!media.current?.healthy || busyRef.current) return;
    setBusyState(true); setError('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Sign in again to begin.');
      const { data, error } = await supabase.from('sessions').insert({ student_id: auth.user.id, case_name: fileName, case_text: caseText }).select('id').single();
      if (error || !data) throw error ?? new Error('Could not create session.');
      media.current.start();
      started.current = Date.now(); sessionIdRef.current = data.id; setSessionId(data.id);
      setPhase('session'); setStatus('Preparing the first question…');
      setBusyState(false);
      await nextQuestion([], 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not begin.'); setBusyState(false); }
  }
  function beginAnswer() {
    const device = media.current;
    if (!device?.healthy || paused || busy || !device.preview.srcObject) return;
    const stream = device.preview.srcObject as MediaStream;
    const audioStream = new MediaStream(stream.getAudioTracks());
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t));
    if (!mimeType) { setError('This browser cannot record an answer. Try Chrome or Edge.'); return; }
    answerChunks.current = [];
    const recorder = new MediaRecorder(audioStream, { mimeType });
    recorder.ondataavailable = e => { if (e.data.size) answerChunks.current.push(e.data); };
    answerRecorder.current = recorder;
    answerStart.current = Date.now();
    recorder.start(); setRecordingAnswer(true); setDraft(''); setStatus('Listening to your answer…');
  }
  async function endAnswer() {
    const recorder = answerRecorder.current;
    if (!recorder || recorder.state === 'inactive') return;
    await new Promise<void>(resolve => { recorder.addEventListener('stop', () => resolve(), { once: true }); recorder.stop(); });
    answerRecorder.current = null; setRecordingAnswer(false);
    if (Date.now() - answerStart.current < 800 || !answerChunks.current.length) { setError('That recording was too short. Record your answer again.'); return; }
    setBusyState(true); setError(''); setStatus('Turning your answer into text…');
    try {
      const blob = new Blob(answerChunks.current, { type: recorder.mimeType });
      const text = await transcribe(blob);
      if (!text) throw new Error('No speech was detected. Record your answer again.');
      setDraft(text); setStatus('Review your answer, then send or re-record.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not transcribe. Record again.'); }
    finally { setBusyState(false); }
  }
  async function sendAnswer() {
    if (!draft.trim() || paused || busyRef.current) return;
    setBusyState(true); setError('');
    try {
      await storeTurn({ role: 'student', content: draft.trim() });
      setDraft('');
      const history = turnsRef.current;
      setBusyState(false);
      await nextQuestion(history, history.filter(t => t.role === 'student').length + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save your answer.'); setBusyState(false); }
  }
  async function finish() {
    setStatus('Saving session recording…');
    const blob = await media.current?.stop();
    const { data: auth } = await supabase.auth.getUser();
    if (!blob?.size || !auth.user || !sessionIdRef.current) { setError('The recording could not be saved. Keep this page open and try again.'); return; }
    const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const path = `${auth.user.id}/${sessionIdRef.current}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('recordings').upload(path, blob, { contentType: blob.type, upsert: false });
    if (uploadError) { setError(`Recording upload failed: ${uploadError.message}. Keep this page open and retry.`); setStatus('Recording not saved'); return; }
    const { error: updateError } = await supabase.from('sessions').update({ status: 'completed', ended_at: new Date().toISOString(), recording_path: path, flag_count: flagsRef.current.length }).eq('id', sessionIdRef.current);
    if (updateError) { setError(`Session status could not be saved: ${updateError.message}`); return; }
    setPhase('finished'); setStatus('Session complete and saved.');
    await media.current?.dispose(); media.current = null;
  }
  function download() {
    const text = [`CTC Bot · ${fileName}`, `Session: ${sessionId}`, '', ...turns.map((t, i) => `${i + 1}. ${t.role === 'probe' ? 'CTC Bot' : 'Student'}: ${t.content}`), '', 'Warnings', ...flags.map(f => `${f.offset_seconds}s · ${f.detail}`)].join('\n\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a'); link.href = url; link.download = 'ctc-bot-transcript.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const questions = turns.filter(t => t.role === 'probe').length;
  return <PageShell>
    <AppHeader />
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div><p className="font-mono text-xs uppercase text-primary">Student session / {phase === 'upload' ? '01' : phase === 'check' ? '02' : '03'}</p><h1 className="mt-2 font-display text-4xl font-bold">Case discussion</h1><p className="mt-2 text-sm text-muted-foreground">{fileName || 'Begin with your case study.'}</p></div>
      {turns.length > 0 && <Button variant="outline" onClick={download}><Download /> Transcript</Button>}
    </div>
    {error && <div role="alert" className="mb-5 border-l-2 border-destructive bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
    {phase === 'upload' && <section className="max-w-2xl space-y-5"><h2 className="font-display text-2xl font-semibold">Upload your case</h2><label className="block cursor-pointer border border-dashed border-primary/50 bg-surface p-10 text-center text-sm text-muted-foreground hover:bg-accent">{busy ? 'Reading case…' : 'Choose a PDF, Word (.docx) or text (.txt) file'}<input type="file" className="sr-only" accept=".pdf,.docx,.txt" disabled={busy} onChange={e => void chooseFile(e.target.files?.[0])} /></label></section>}
    {phase !== 'upload' && <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <main className="min-w-0 space-y-6">
        {phase === 'check' ? <section className="space-y-5"><h2 className="font-display text-2xl font-semibold">Camera & microphone check</h2><p className="text-sm text-muted-foreground">Both must stay on. Your video and audio are saved for instructor review; leaving the page or unusual face counts will be flagged.</p><div className="flex gap-3"><Button disabled={busy} onClick={() => void connect()}><Camera /> {media.current?.healthy ? 'Reconnect devices' : 'Enable camera & mic'}</Button><Button disabled={!media.current?.healthy || busy} variant="outline" onClick={() => void start()}><Play /> Start session</Button></div></section> : <section><div className="mb-5 flex items-center justify-between border-b border-border pb-4"><div><h2 className="font-display text-2xl font-semibold">{phase === 'finished' ? 'Session complete' : 'Conversation'}</h2><p className="mt-1 font-mono text-xs text-muted-foreground">{Math.min(questions, 5)} / 5 questions</p></div><span className="text-xs text-muted-foreground">{flags.length} {flags.length === 1 ? 'warning' : 'warnings'}</span></div>
          <div aria-live="polite" className="space-y-4">{turns.map((turn, i) => <div key={i} className={`max-w-[90%] border-l-2 px-4 py-3 text-sm leading-relaxed ${turn.role === 'probe' ? 'border-primary bg-accent/60' : 'ml-auto border-foreground bg-secondary'}`}><p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">{turn.role === 'probe' ? 'CTC Bot' : 'Your answer'}</p>{turn.content}</div>)}</div>
          {phase === 'session' && <div className="mt-8 border-t border-border pt-5"><p className="mb-3 text-xs text-muted-foreground" role="status">{paused ? 'Paused — reconnect camera and microphone to continue.' : status}</p>{paused ? <Button onClick={() => void connect()} disabled={busy}><RotateCcw /> Reconnect devices</Button> : <div className="space-y-3">{draft && <div className="border border-border bg-surface p-4 text-sm"><p className="mb-2 font-mono text-[10px] uppercase text-muted-foreground">Your recorded answer</p>{draft}</div>}<div className="flex flex-wrap gap-2">{recordingAnswer ? <Button onClick={() => void endAnswer()}><Square /> Done</Button> : <Button disabled={busy || !turns.length || turns.at(-1)?.role !== 'probe' || questions > 5} onClick={beginAnswer}>{draft ? <RotateCcw /> : <Mic />} {draft ? 'Re-record' : 'Answer'}</Button>}{draft && <Button disabled={busy} onClick={() => void sendAnswer()}><Send /> Send answer</Button>}{!draft && turns.at(-1)?.role === 'student' && !busy && <Button variant="outline" onClick={() => void nextQuestion(turnsRef.current, turnsRef.current.filter(t => t.role === 'student').length + 1)}>Retry question</Button>}{questions > 5 && phase === 'session' && !busy && <Button variant="outline" onClick={() => void finish()}>Retry saving recording</Button>}</div></div>}</div>}
          {phase === 'finished' && <p className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground">Your recording and transcript are saved for your instructor.</p>}
        </section>}
      </main>
      <aside className="space-y-4"><div className="relative aspect-[4/3] overflow-hidden bg-foreground"><video ref={preview} autoPlay muted playsInline className="h-full w-full object-cover [transform:scaleX(-1)]" /><div className="absolute bottom-2 left-2 bg-background/90 px-2 py-1 font-mono text-[10px] text-foreground">{phase === 'finished' ? 'Camera off' : paused ? 'Paused' : media.current?.healthy ? 'Camera on' : 'Camera preview'}</div></div><div className="flex items-center gap-2 text-xs text-muted-foreground">{media.current?.healthy ? <Mic className="size-4 text-primary" /> : <MicOff className="size-4" />}{media.current?.healthy ? 'Microphone connected' : 'Microphone not connected'}</div>{flags.length > 0 && <div className="border-t border-border pt-4"><h3 className="mb-3 flex items-center gap-2 font-display text-lg"><AlertTriangle className="size-4" /> Warnings</h3><ol className="space-y-2 text-xs text-muted-foreground">{flags.map((f, i) => <li key={i}>{Math.floor(f.offset_seconds / 60)}:{String(f.offset_seconds % 60).padStart(2, '0')} · {f.detail}</li>)}</ol></div>}</aside>
    </div>}
  </PageShell>;
}

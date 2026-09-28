# CTC Bot Phase 2: Proctored voice sessions

## What students will experience
1. **Sign in**, upload a case, then pass a **camera and microphone check** that shows a live preview. They can't start until both work.
2. **Spoken interview:** CTC Bot reads each of the 5 questions aloud. The student presses "Answer" and speaks, then presses "Done". Their answer is turned into text and shown in the chat. They can re-record before sending.
3. **Proctoring during the session:**
   - Their camera preview stays on screen at all times.
   - If they turn off the camera or mic, the session pauses until both are back on.
   - Warnings are shown and logged when they: leave the tab or window, can't be seen, or appear with someone else (more than one face).
   - The full session (video and audio) is recorded.
4. At the end, the recording, transcript and warnings are saved. The student can still download the transcript.

## What instructors will experience
- They sign in to an **Instructor dashboard** listing every session: student, case, date, and number of warnings.
- Opening a session shows the video recording, the full question-and-answer transcript, and a timeline of warnings.
- Instructor access has to be granted. The first instructor account will be set up for you, and after that instructors can promote other accounts.

## Things to know
- This needs **Lovable Cloud** for sign-in, saved sessions and video storage. I'll turn it on.
- Face checks run inside the student's browser. They're a helpful signal, not proof of cheating, so instructors should review flagged moments themselves.
- Recordings take up storage space. Each session is saved as one video file.
- Voice uses Lovable's built-in AI (speech in both directions), so each session uses a bit more AI credit than before.

## Technical details
- Enable Lovable Cloud. Tables: `profiles`, `user_roles` (enum `student`/`instructor`, `has_role()` security definer), `sessions` (student_id, case_name, case_text, status, started/ended, recording_path, flag_count), `session_turns` (session_id, idx, role, content), `session_flags` (session_id, type, at, detail). RLS: students manage their own rows; instructors read everything via `has_role`. Private storage bucket `recordings` with per-user folder policies, and instructor read access.
- Routes: `/auth`, `_authenticated/` gate, `/_authenticated/session` (student flow), `/_authenticated/instructor` and `/_authenticated/instructor/$sessionId` (role-checked server fns).
- TTS: server fn using `/v1/audio/speech` with `google/gemini-3.1-flash-tts-preview`, streamed to the browser. STT: server fn using `/v1/audio/transcriptions` with `google/gemini-3.5-transcribe` on the complete answer recording.
- Proctoring: `getUserMedia` stream, MediaRecorder (webm) uploaded to storage at the end; track `ended`/`mute` listeners pause the session; `visibilitychange`/`blur` flags; face count via MediaPipe Face Detector (browser WASM) sampled every 2s.
- Question logic stays in `probe.functions.ts` (5 questions + closing); turns and flags are written to the database as they happen.
- Update AGENTS.md: session data is now saved in Cloud, which replaces the in-memory-only rule.

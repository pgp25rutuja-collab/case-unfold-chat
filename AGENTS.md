<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- Case files (PDF/DOCX/TXT) are parsed in the browser with pdfjs-dist and mammoth — the Cloudflare Worker runtime can't run native document parsers.
- AI questions go through `src/lib/ai.server.ts` and `src/lib/probe.functions.ts`; voice uses authenticated server routes — credentials must remain server-side.
- Proctored sessions, transcripts, warnings and recordings persist in Lovable Cloud; student/instructor access is enforced by RLS and private storage policies.
- The browser composites a stable canvas/video and microphone audio stream for one session recording, so reconnected devices do not break the recorder.

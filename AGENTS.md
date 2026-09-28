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
- All AI calls go through `src/lib/ai.server.ts` (Lovable AI Gateway, Responses API, streamed server-side) and are exposed to the UI only via `src/lib/probe.functions.ts`.
- The probe session is in-memory only: no database, no persistence; the transcript is downloaded client-side.

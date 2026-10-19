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

- Long-term memory lives per user in the `user_memories` table (via `src/lib/memory.server.ts`); Google Drive memory was removed — keep memory in the database.
- `/api/chat` streams `data: {"stage": ...}` SSE events before model output so the UI can show progress steps; keep new tools (search, image) emitting stages.
- Backup API key pool is capped at 2 and deduplicated on save; keys are only read server-side for AI calls.
- Adapt gpt-engineer as typed prompt/routing and safe fenced-file extraction; never bundle or execute its Python CLI in the web runtime.
- Multi-file outputs are downloadable projects, not automatically concatenated or published websites; the workspace exports validated relative paths and sends edited sources through the existing chat.

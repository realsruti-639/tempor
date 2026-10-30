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

## Tempor architecture
- Timer, Pomo-Bot state and line selection live as pure functions in `src/lib/tempor/core.ts`; keep them free of React/browser APIs so they stay unit-tested.
- Elapsed time is always derived from a saved wall-clock `endAt`, never from counting interval ticks — keeps backgrounded tabs, sleep and reloads accurate.
- Focus completions are counted via `sessionId` vs `lastCountedSessionId` so a session can never count twice (reloads, re-renders).
- All user data persists only in localStorage via `src/lib/tempor/storage.ts`, which validates each field independently so corrupt/old saves recover without losing valid parts.
- Ambient sound is generated with Web Audio in `src/lib/tempor/audio.ts` (no remote audio files); the AudioContext is only created/resumed inside a user gesture.
- The focus/break accent is the `--mode` CSS variable driven by `data-mode` on `<html>`; only the root transitions it (nested transitions of an inherited custom property lag).

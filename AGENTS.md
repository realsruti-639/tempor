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
- Ambient sound is a Web Audio mixer in `src/lib/tempor/audio.ts` (no remote audio files): each channel has its own gain bus, generators start lazily and stop after fading to 0; the AudioContext is only created/resumed inside a user gesture. Visuals read loudness via `energy()` (AnalyserNode).
- The palette accent is `--mode`/`--mode-2`, switched by `data-phase` (focus|rest, from `isRestPhase`) on `<html>`; only the root transitions them (nested transitions of an inherited custom property lag).
- Ghost Terminal commands are parsed by the pure `parseCommand` in `src/lib/tempor/commands.ts`; the route maps parsed commands to actions.
- Grid Credits are awarded inside `settle()` alongside the session count, and cosmetics purchase/equip logic is pure in `src/lib/tempor/upgrades.ts`, so rewards share the count-once guarantee.

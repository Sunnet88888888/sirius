# Decisions

1. **Single organization mode.** One school; multi-org stays disabled.
2. **Expected outputs of code tasks come from running a reference solution in Judge0**, never from the model's guess.
3. **Reference solutions never reach students.** The API strips them from task contents.
4. **Own image builds.** The server runs images built from this repository, tagged by git hash; the previous tag is kept for rollback.
5. **Feature branches** per job: branding, code task view, AI code tasks.
6. **Dark theme is generated, not hand-written.** The UI uses hard-coded light colors in about 870 files. Tailwind compiles every color class to a CSS variable, so `styles/dark.css` swaps the palette under `html.dark` and adds overrides only where one variable serves two roles (`bg-white` vs `text-white`). `scripts/gen-dark-css.mjs` regenerates it from the classes in use. Trade-off: colors written as inline styles or raw hex in CSS are not covered and are fixed case by case.
7. **Theme default is light.** Dark is opt-in through the toggle until every screen has been checked in it.
8. **The student code workspace is a presentation component.** `CodeTaskWorkspace` has no saving or grading logic. It receives everything from `TaskCodeObject`, so autosave, submit gating and hidden-test rules stay in one place. Teacher and grading views are unchanged.

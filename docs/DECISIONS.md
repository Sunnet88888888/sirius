# Decisions

1. **Single organization mode.** One school; multi-org stays disabled.
2. **Expected outputs of code tasks come from running a reference solution in Judge0**, never from the model's guess.
3. **Reference solutions never reach students.** The API strips them from task contents.
4. **Own image builds.** The server runs images built from this repository, tagged by git hash; the previous tag is kept for rollback.
5. **Feature branches** per job: branding, code task view, AI code tasks.

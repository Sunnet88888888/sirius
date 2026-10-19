# Code task workspace (student view)

## What it does
A student opens a code task and sees two panes side by side:
- Left: statement, hint, reference file, and the visible tests as examples (input and expected output). Scrolls on its own.
- Right: editor on top; below it a results area with one entry per test, showing input, expected and actual output, errors and time.
Hidden tests are listed as locked entries and counted, never shown.

## Controls
- **Run tests** (also Ctrl/Cmd+Enter) runs the visible tests only. Hidden tests run when the work is graded.
- **Reset** returns the editor to the starter code (asks first).
- **Full screen** (Esc to leave) fills the window; the editor keeps its content.
- Drag the vertical divider to change the pane widths and the horizontal one to change the results height. Double-click a divider to reset it. Sizes are remembered in the browser.
- When the workspace is narrower than 760 px it switches to three tabs: Description, Code, Results.

## What did not change
Autosave, "Submit for grading", the lock after submission, anti-paste, "must pass visible tests", hidden-test secrecy, and the teacher and grading views.

## Files
- `components/Objects/Activities/Assignment/CodeTaskWorkspace.tsx`: the view.
- `.../TaskEditor/Subs/TaskTypes/TaskCodeObject.tsx`: student branch renders the workspace.
- `components/Objects/Activities/Assignment/AssignmentStudentActivity.tsx`: no stacked header for code tasks.

## Rollback
Redeploy the previous image tag with `deploy.sh --rollback <sha>`.

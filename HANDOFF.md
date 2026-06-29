# MindFlow handoff

## Current task

Improve node-add and mobile UI behavior:

- Make the top/root node show a reliable plus button for adding children.
- Ensure nodes that currently lack a plus affordance can add children.
- After adding a node on mobile, enter text editing automatically.
- Fix child-add at the second level creating a sibling instead.
- Make the collapsed mobile tools UI less intrusive.
- Expand the mobile saved-map list so older maps are visible.

## Findings

- Main app logic is in `src/main.js`; the active UI is rendered inline by `renderAppShell`.
- `src/components/toolbar.js` appears to be an older/alternate toolbar module and is not imported by `src/main.js`.
- The current child add helper calls `mindMap.execCommand('INSERT_CHILD_NODE', true, [targetNode])`.
- The current sibling add helper calls `mindMap.execCommand('INSERT_NODE', true, [targetNode])`.
- Root quick-add already exists as `#rootQuickAddBtn`, but its position is tied to `rootNode.getRect()` and can end up inaccessible/hidden.
- Mobile CSS lives in the `@media (max-width: 860px)` block in `src/style.css`.

## Work log

- Created this handoff file before edits so another LLM can continue if context runs out.
- Updated `src/main.js` so node actions prefer the live active node, insert with the new node activated, and explicitly open text edit after render.
- Updated root quick-add positioning to use the same screen-rect helper as keyboard navigation and clamp it inside the viewport.
- Updated mobile CSS so the saved-map sidebar has much more vertical room and the collapsed Tools handle becomes a small round button.

## Verification notes

- `node node_modules/vite/bin/vite.js build` passes.
- Dev server started at `http://127.0.0.1:5173/`.
- Browser smoke test: root `+子ノード` is visible; clicking it inserts a new topic and opens `.smm-node-edit-wrap` with `新しいトピック`.
- Browser console only showed Vite connection logs.
- The in-app browser wrapper did not expose viewport resizing in this session, so mobile CSS was verified by code review rather than a rendered mobile screenshot.

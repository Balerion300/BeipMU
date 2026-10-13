# Original BeipMU completion checklist

Current audit: October 13, 2026. Target: original 4.335, compared against its
isolated executable, `src/`, and every topic in `Documentation/`. This is the
current checklist; historical milestone sections in FEATURE-PARITY are evidence
for individual slices, not current lists of missing features. No percentage is
assigned. A row closes only with source/reference comparison and real behavior.

Status: **partial** means useful behavior exists but original parity remains;
**open** means not implemented; **in progress** is not a verified release claim.
The independent recovery implementation and missing upstream dependencies remain
as described in README. The original source stays intact.

## Current validated preview 0.16, October 13, 2026

The unfinished 0.16 integration has now passed the release gate. This current
section supersedes the historical handoff, closeout and draft failure notes below.
No full-upstream-parity percentage is assigned. PR #2 remains open and unmerged;
merging still requires a later explicit human instruction.

### Validated changes

- Primary and additional forms use one owner-bound history cursor/draft. Whole
  multiline entries retain blank lines and prefixes, support configured send/
  history/push actions, and restore without recapture or another owner's history.
  Ctrl+Down is Push to History, distinct from assignable Move Selection Down.
- Original Type 0 InputWindow layouts/settings import with global versus copied
  settings behavior. Former floating inputs import as reviewed docked panes.
- ANSI faint, reverse, literal OSC send/prompt links and system-bell routing are
  integrated. Faint precedes reverse and equal-color protection; default/palette
  transitions follow inspected AnsiParser source. Exact missing Color.Darken(128)
  rounding remains unverified; recovery uses floor(channel/2).
- `/roll` retains the 34 original 4.335 comparisons and passes packaged owner,
  silent feedback, numeric-prefix/error and script interception checks. `/quit`
  remains unknown per original executable evidence. Normal `/exit` waits for a
  request-specific successful atomic settings save, then uses native WM_CLOSE.
  Save failure, timeout, stale receipts and cancelled owners leave the app open.
- Bootstrap diagnostics report only safe filename/line information; all 103
  classic scripts parse independently and together. The Node continuation startup
  allowance is 3000 ms; the rules execution watchdog remains 500 ms.

### Current acceptance evidence

`build/build-0.16-current.log` records a successful current-source native build
and all 56 JavaScript test files. `test-results/sessions-20261013-080408` contains
fresh/persisted result and wire files written after Python assertions. These cover
real primary/additional grouped submissions through native save, same-process
reopen and second-process replay, with exact single-record disk checks, owner/
epoch cancellation and historical-avatar isolation. New input/import/ANSI
screenshots and fresh Pueblo/MXP image/link/spacing screenshots were inspected.

`test-results/exit-20261013-080532` proves normal process closure in both phases,
restart profile/preferences persistence, `/quit` rejection and exact native
`saved -> exit-request -> WM_CLOSE -> WM_DESTROY` ordering without watchdog close.
`tests/package_test.py` checks the full 137-file source/package/ZIP inventory,
bytes, duplicate entries, CRC and SHA-256. The prior mixed ZIP was preserved in
`build/preserved-016-20261013`; old failed evidence remains separately preserved.
CI status is tracked separately in GitHub Checks, not inferred from local tests.

### Remaining priorities

1. Floating input/edit windows, native cross-window drag, complete original saved
   arrangements and history search/selection/editing behavior beyond this slice.
2. Blink/flash, custom beep files and exact faint rounding; remaining original
   commands and source/documentation discrepancies.
3. Synchronous script host reads, reentrant Receive/prompt semantics, remaining
   actions/object members, native COM/filesystem and script-language compatibility.
4. Logging rotation/multiple files, negotiated CHARSET/MCP/MCMP, map/media/stat/
   tilemap/web-view completeness and profile/settings gaps in the ledger below.

History persistence retains a 60 KiB serialized UTF-8 record bound. No fresh TLS,
subjective audio, native titlebar-drop or decoder-animation-pause claim is made;
stress testing stays deferred. Original src remains intact; this is independent
Win32/WebView2 recovery work. Earlier paused/failed-draft notes below are historical.

## Historical handoff to Sol High lead, October 13, 2026

The user requested a new coordinating chat with Sol High leading and Sol Medium
implementation agents continuing parity work. Complete the unfinished 0.16
integration and verification first. An earlier instruction asked to pause after
that build; the latest instruction explicitly requests continuation in the new
chat. No merge is authorized. The old coordinator is yielding ownership and has
no live implementation agents or recovery test app remaining.

### Repository and preserved work

- Project root is `D:\Users\Elio\OneDrive\Documenti\New project`, but all Git and
  build operations belong in its `BeipMU-Pueblo` subdirectory. Origin is
  `https://github.com/Balerion300/BeipMU.git`; BeipMU is separate from Potato,
  MUSHclient and Valyria. Preserve preexisting untracked `output/`.
- Active branch `codex/client-features` is at `e8041bb`, a local integration merge
  of `codex/parity-016-draft` (`609b474`) over the closeout commit `51c6e9a`.
  This is not a merge of PR #2. GitHub PR #2 remains open at `51c6e9a`, checked
  October 13. Attach https://github.com/Balerion300/BeipMU/pull/2 to the new chat.
- Source edits remain **uncommitted**. Do not reset or replace the checkout.
  `git status --short` identifies them; new untracked implementation files are
  `recovery/ui/bootstrap.js`, `recovery/tests/bootstrap_test.cjs`, and
  `recovery/tests/input_history_test.cjs`. Documentation edits also remain local.
- Latest published release is still `recovery-preview-0.15`, checked October 13.
  `dist/BeipMU-Recovery-0.16` is a mixed development package, not the final current
  source build. Do not release its existing ZIP.

### What was diagnosed and verified

- Both earlier 0.16 packaged timeouts came from an extra closing parenthesis in
  `app.js`'s ANSI style condition. The script could not parse, so it never sent
  `ready`; the trace stopped at `UI emoji` / `HOST emoji`. The syntax fix is local.
  `bootstrap.js` captures early safe filename/line diagnostics; its new test
  parses all 101 shipped classic scripts separately and in shared lexical scope.
- Original failing evidence was copied before reruns to
  `recovery/build/preserved-016-20261012/`, including both old logs and session,
  Pueblo and MXP evidence. Do not substitute the old logs for the newer results.
- Copying only the corrected `app.js` into the old 0.16 package made
  `preview_test.py` pass Pueblo and MXP images, link sends and line/WHO spacing.
  Their screenshots were inspected. This confirmed the startup diagnosis without
  changing deadlines.
- That same package subsequently completed fresh and persisted acceptance in
  `test-results/sessions-20261012-104722`. Both `first-result.json` and
  `persist-result.json` plus wire evidence exist; these files are written after
  each phase's Python assertions. They cover draft Type 0 input import, reverse,
  OSC, BEL, roll and prior features. The original process completion tool result
  was lost when this chat stopped; the completed artifacts were inspected on
  October 13. They do **not** verify later uncommitted faint/history/exit changes.
- On October 13, `bootstrap_test.cjs`, `input_history_test.cjs`,
  `ansi_actions_test.cjs` (10 checks) and `ansi_restore_test.cjs` passed again.
  No full build or final package verification of the entire current tree exists.

### Unfinished agent slices and suggested ownership

1. **Layouts/input:** `input-panes.js` now models the primary input alongside
   additional panes with one history cursor/draft, whole multiline entries and
   owner-bound history callbacks. `input-owner-controller.js` and `dock-panels.js`
   expose capture; `input_history_test.cjs` passes. **Central integration is
   incomplete:** inspect primary submit handling and `shortcut-ui.js`; the old
   primary path may still split lines/use `session.historyIndex`. `app.js` has
   `recordInputHistory` and removed additional-pane duplicate capture, but do not
   assume it is fully wired. Add packaged primary/additional/grouped history
   assertions; the old agent had not saved those fixture edits when interrupted.
2. **Scripting/commands/central integration:** owns `app.js`, `index.html`,
   `core-test.js`, `features.js`, `main.cpp`, command/runtime modules and harnesses.
   Syntax/bootstrap fix is present. `trigger_continuation_test.cjs` now gives
   Node startup 3000 ms separately from the unchanged 500 ms execution cap; the
   agent reported 19 staged cases passing. `/exit` locally saves settings and
   sends `window:exit` to native `WM_CLOSE`. It lacks packaged process-close,
   save-order and persistence acceptance. The proposed separate `--test-exit`
   fixture was **not implemented**. `/quit` must remain unknown. `/roll` retains
   the 34 original captured comparisons described below.
3. **Settings/protocols:** faint SGR 2/22/0 added in `ansi-state.js`; dimming precedes
   reverse and equal-color protection. Tests and `ansi-actions-fixture.js` include
   faint cases. Original source uses missing shared `Color.Darken(128)`; recovery
   uses floor(channel/2), so exact rounding is explicitly unverified. Review
   default-foreground semantics. `restore-model.js` locally allows multiline
   history for the input work; verify full capture/save/replay together. Blink,
   custom bell files and subjective audible verification remain open.

Use three `gpt-6.1-sol` agents at `medium`, `fork_turns: none`, with self-contained
handoffs and disjoint ownership. Lead is `gpt-6.1-sol` at `high`, responsible for
review, integration, focus coordination, final builds, package verification and
publishing. No agent should switch branches or run competing native fixtures.

### Finish and release gate

Read the current diff before modifying it. Finish the integrations above, then
run `./recovery/build.ps1 -SkipSdkDownload`, fresh/persisted `session_test.py`,
`preview_test.py`, and a meaningful normal native exit test. Inspect new input
and ANSI screenshots. Never merely extend test deadlines to obtain a pass.
Do not repeat interactive temporary-root TLS setup blindly: the last full-app
TLS attempt timed out; no fresh pass, subjective audio, native titlebar drop or
decoder-level animation-pause claim is inherited. Stress testing stays deferred.

Update this checklist, README, FEATURE-PARITY and SCRIPT-PARITY to distinguish
released behavior from open gaps. Verify source/package file bytes, ZIP contents
and hash, then commit/push only the intended recovery changes, publish the tested
preview, verify GitHub asset digest and CI status. Never merge PR #2.
GitHub CLI is `../.tools/bin/gh.exe`; direct auth was absent but Git credential
helper works. Obtain its token silently in process environment, never print it.
Use UTF-8 body files for release/PR text, REST PATCH if GraphQL is limited.
Python file I/O must explicitly use UTF-8. GUI operations require the computer-use
skill's `node_repl`/`@oai/sky`; native CUA is disabled. Use isolated credential-free
reference CWD/config only. Original source remains intact; recovery is independent
Win32/WebView2 work, not complete upstream compatibility.

## Development resumed after preview 0.15

The user resumed this project on October 12, 2026 with three Sol Medium
implementation agents and a coordinating review/integration chat. The dated
closeout below is historical. The unpublished 0.16 draft has been integrated
for correction and acceptance; it is not yet a published or verified milestone.
PR #2 remains open and must not be merged without a later explicit instruction.

## Historical closeout at preview 0.15

Work stopped at the user's request on October 12, 2026. The latest published
preview is [0.15](https://github.com/Balerion300/BeipMU/releases/tag/recovery-preview-0.15),
release commit `49b622e654fd88a322fdcdd88ed094178f9a9fe5`. PR #2 remains open;
nothing is merged. The rows below are updated for validated coverage through 0.16; this closeout paragraph itself records 0.15 history.

The native build, all 48 JavaScript test files, fresh and persisted packaged
sessions (`sessions-20261012-100046`), and compiled Pueblo/MXP spacing/link/image
fixtures passed. The branch CI passed; the PR CI and its retry failed on the
Node rules-worker startup deadline. A separate TLS acceptance attempt timed out
around temporary certificate setup; its temporary CA was removed. Native
titlebar drop and subjective audio remain unverified. Stress testing is deferred.

### Next work, in priority order

1. Resolve the CI worker-startup failure and the unpublished draft's packaged
   startup timeouts, then rerun fresh/persisted and Pueblo/MXP acceptance before
   any further preview. Keep execution watchdogs bounded. Obtain fresh TLS
   acceptance separately; do not inherit an older pass.
2. Finish input/window parity: original Type 0 input-layout import, global versus
   copied settings, floating input/edit windows, primary/additional history and
   selection rules, grouped multiline history restoration, and native drag/drop.
3. Finish ANSI and command behavior: reverse, OSC send/prompt links, BEL, faint,
   blink/flash and custom beep; `/roll`, normal `/exit`, and the remaining command
   ledger. Source/docs disagreements need executable evidence, not assumed aliases.
4. Complete trigger/script semantics: synchronous host reads after Run, reentrant
   Receive and prompt processing, all original actions, Unicode range equivalence,
   full object members and existing-script/COM/filesystem/language compatibility.
5. Continue the remaining rows: logging rotation/multiple files, network CHARSET
   and MCP/MCMP, map tools, stats/tilemap/media, full Pueblo/MXP, web views, profile
   import/export and settings. Packaging and platform claims need their own tests.

### Preserved unpublished work

The local-only branch `codex/parity-016-draft`, checkpoint
`609b4746f0bc29dc402efb4cf2b523a36c8b4aed`, preserves the next slice. It is not
pushed, released, or part of 0.15. The active branch is `codex/client-features`.
The draft includes Type 0 input import/settings inheritance, reverse colors,
literal OSC send/prompt links and system-bell handling, `/roll`, and a separate
test-worker startup allowance without extending the execution watchdog.

Its native build and 53 JavaScript test files passed, but packaged session
acceptance (`sessions-20261012-101702`) and the Pueblo fixture timed out. The
cause remains undiagnosed; no packaged behavior is claimed for this draft.
Local logs are `recovery/build/sessions-0.16.log` and `preview-0.16.log`.
The next session should inspect these before rebuilding; generated files are
ignored and are not a substitute for the published 0.15 artifact.

The original 4.335 scratch reference supplied 34 `/roll` responses, all matching
the draft with captured dice faces. Evidence is local under
`recovery/build/next-commands/reference-20261012/` (`roll-observed.txt`,
`observed-matrix.json`, `OBSERVATIONS.md`). This establishes command behavior,
not packaged integration. The original executable rejects `/quit` as an unknown
command despite its Markdown entry; normal `/exit` works in that reference.
Faint/blink/custom-beep and native exit integration remain unfinished.

| Area and original evidence | Current coverage | Completion work |
| --- | --- | --- |
| Shell/Windows menu (`Wnd_Main`, direct menu) | Partial: tabs, named panes, four edges, nested splits/tabs, native floating, layout/appearance copy | Native drag between windows; floating input/edit windows; multiple main windows; hidden captions; original saved arrangements |
| Worlds (`Dlg_Connect`, `Root.prp`) | Partial: worlds/characters, startup, TLS, credential vault, notes, reviewed connect templates | Complete import/export and per-character flags; puppets and transfer behavior; world samples |
| General settings (`Dlg_Settings`, direct dialog) | Partial: inline images and height, avatar geometry, visible animation pause, sound enable | Voice/markup; activate-on-disconnect; close alerts; Ctrl-to-change-layout |
| UI Theme settings | Partial: dark/light | Original theme elements, presets and all customizable colors |
| Input Windows/settings (`Dlg_InputWindow`, `Wnd_Input`) | Partial: independent font/styles/colors, sticky input, autosize, unknown-command setting and docked additional panes with prefixes | Remaining history search/selection/editing rules; floating input panes; spell checking; tab completion; command prefix settings |
| Output Windows/settings (`Dlg_TextWindow`, `Wnd_Text`) | Partial: font/styles/colors/margins, paragraph spacing, wrapped indent, fanfold and fixed width | Exact selection/scrolling options; timestamps/line metadata; complete split behavior and preservation across every pane |
| Logging/settings (`Logging`, `OM_Logging`) | Partial: reviewed filenames/date/environment tokens, local chooser, formatted text/HTML, typed/sent prefixes, start positions and character auto-start | Multiple concurrent files, midnight automatic rotation, complete original timestamp-flag import and per-character lifecycle |
| Network/settings (`Telnet`, `Connection`, `CodePages`) | Partial: telnet, Schannel TLS, NAWS, GMCP and manual UTF-8/CP1252/CP437 choices | Automatic CHARSET negotiation, reconnection/keepalive, terminal types, debug output, MCP/MCMP and all negotiated options |
| Taskbar/settings (`Wnd_Taskbar`, `Dlg_Settings`) | Partial: activity, connection, unread and saved character tab colors | Exact theme blending, grouping, notification and taskbar options |
| Keyboard Shortcuts (`Shortcuts.md`, `Dlg_Settings`) | Partial: remappable supported actions | New main window/input pane; context-sensitive history and output navigation; all original actions |
| Auto Emoji (`Emoji.md`, assets and settings) | Implemented documented workflow: original default table, sections, append/replace, Unicode matching, copy/edit/import/save/reload/revert and enable | Original matching implementation is absent; exact undocumented boundary behavior remains an independent reconstruction |
| Scripting (`ScriptingAPI.md`, `OM.idl`, `*_OM`) | Partial: expanded API subset and member inventory | See SCRIPT-PARITY for exact object/member list; controlled native filesystem/COM, existing-script compatibility and script languages |
| Restore Logs/settings (`Logging`, `Dlg_Settings`) | Partial: bounded per-character snapshots, startup replay, pause/clear controls and reviewed original Restore.dat import | Exact original visual-trigger/spawn replay, raw native encoding and disable/deletion semantics |
| ANSI Colors/settings (`AnsiParser`, `TextToLine`) | Partial: custom 16-color palette/presets, bright backgrounds, bold/invisible-color policy, parse toggle and received-line reset | Exact faint rounding, blinking/flashing, custom beep and complete OSC URL behavior |
| AI/settings (`Dlg_Settings`, `Wnd_Input`) | Open | Original local-model integration, model configuration and input actions; no credentials or live service use in tests |
| User Data/settings (`Dlg_Settings`) | Open | Original paths, backup/import/export/move behavior and dialogs |
| Aliases (`Aliases.md`, `Connection`) | Partial: scoped nested tree, variables, pre/post order, Active/Echo/ProcessCommands, owned awaited dispatch | Debugger, input prefixes and remaining exact compatibility limits |
| Triggers (`Triggers.md`, `Connection`, `Dlg_Triggers`) | Partial: scoped/nested/repeated matches, multiline child windows, capture-only children, captured-group appearance, click-only commands, resumable send/filter/script order and incremental text edits | Font/hash/flash/paragraph actions, reentrant receive and synchronous host-read behavior, untitled capture, full conditions/actions and debugger |
| Find/history/editing (`Dlg_Find`, `Wnd_Input`) | Partial: direction/case/word/regex search and command replacement | Full history search/recall selection and editing semantics; editor windows |
| Smart Paste (`Dlg_SmartPaste`) | Partial: text/file/clipboard preview, saved affixes, zero delay, pacing/cancel | Actual clipboard-read acceptance and exact scheduling/alias behavior |
| Client commands (`CommandLine.md`, `Commands.cpp`) | Partial | Audit every command below; original source also has commands absent from the Markdown index |
| Map/Atlas (`Mapping.md`, assets, original schema) | Partial: layers, rooms/exits/routes, rectangles, cross-map/dangling links, sample-complete import/export, shared canvas and session position/tracking | Image/label objects, complete geometry editing/toolbar, ambiguous location tracking and original renderer parity |
| Spawn windows (`SpawnWindows.md`) | Partial: grouping/capture/move/copy/log gag | Multiple independently positioned streams, formatting in all floating modes, original capture semantics |
| Stats (`Stat Windows.md`, `GMCP`) | Partial: text/range/progress | Full GMCP styles/layout, window ownership/docking and script objects |
| Tilemap (`TileMap.md`) | Partial: real rendered tiles, encodings and partial updates | Original size limits, windows and complete format behavior |
| Images/avatars (`ImagePane`, `ImageBanner`) | Partial: inline/load/fallback/linked images, dock/float history, fit/zoom/pan, save/copy, visible pause, avatar geometry/live updates | Decoder-level animation pause and complete missing-renderer behavior; Save/Copy are recovery additions, not proven original ImagePane controls |
| Client.Media (`GMCP.md`) | Partial: default/load/play/stop module | Actual audible playback and remaining formats/options |
| Pueblo/MXP (`TextToLine`, parser evidence) | Partial: links/images/styles, ordinary Pueblo HTML line folding and PRE WHO spacing protected | Full elements/entities/definitions, secure modes, sound/frames/image maps; conformance evidence |
| Web views (`WebViews.md`, `WebView`) | Open | Original named views/navigation/script surface with isolated web content |
| MCP editing (`MCP_*`, `MCMP`) | Open | Negotiate, simpleedit, status, ping, userlist packages and editor integration |
| Help/menu/documentation | Partial: About and subset command help | Complete local command help, original help actions and accurate shipped documentation |
| Distribution (`Wineskin.md`, build/resources) | Partial: Windows x64 preview | Full upstream-equivalent packaging/update behavior; platform claims require platform evidence |

## Command acceptance ledger

Already implemented subsets: `/@`, `/ansireset`, `/capturecancel`, `/chars`,
`/clear`, `/close`, `/connect`, `/connectioninfo`, `/delay`, `/disconnect`,
`/echo`, `/log`, `/logall`, `/naws`, `/new`, `/printenv`, `/recall`, `/receive`,
`/reconnect`, `/set`, `/setinput`, `/switchtab`, `/unset`. Existing names do not
imply every argument matches: `/new` currently opens a tab, `/recall` and `/log`
have recovery semantics. Named log files are implemented; automatic NAWS remains a gap.

Additional supported subsets in 0.11: `/autolog`, `/logtop`, `/stoplogs`, `/newtab`,
`/world`, `/removelast`, `/receivegmcp`, `/gmcp dump_on|dump_off`, `/silence`,
`/wall`, and `/idle`. The command fixture checks native wire and session ownership;
`/world` positive routing is unit-tested, while packaged tests check invalid
character rejection. Idle time is bounded to 1–1440 minutes.

Additional supported subsets in 0.14-0.15: `/repeat`, `/gag`, `/grab`, `/tabcolor`,
`/resetscript` and docked `/newinput`. Repeat is capped at 64, script reset is
owner-scoped, and floating extra-input editing remains open.

Additional supported subsets in 0.16: `/roll` and normal `/exit`. `/quit` stays unknown per the inspected original executable.

Open original commands/options from documentation/source: `/debugnetwork`, `/debugtriggers`, full `/help`, `/map_addroom`, `/map_addexit`, `/newedit`,
`/opendialog`, `/ping`, `/puppet`, `/puppets`,
`/script`, `/slist`, `/ttype`, `/webview`.
Source-only commands and historical version differences must be reconciled
before this ledger can be called exhaustive.

## Release evidence

The historical preview 0.10 starting point is commit
`969080ea735e5a83a06d11dfa6ef8ee39d27a92e`. Both GitHub native builds passed. Its evidence is recorded in README.
Preview 0.10 implements the following **subsets**: independent window
appearance/input behavior and import, reviewed connect templates, nested edge
splits/tabs and supported original docking import, expanded script APIs,
direction/case/word/regex find and input replacement. Fresh/persisted packaged
acceptance passed in `sessions-20261012-074009`; source/module checks passed;
Pueblo/MXP image/link/WHO checks passed. All remaining work in each row stays open.
Native titlebar drag emission and ownership-aware receiver are implemented and
compiled. Opening a native floating history pane was manually verified. The UI
automation tool rejected the cross-window drop onto our WebView2 renderer, so
manual pointer/drop acceptance is still outstanding;
this preview does not claim native drag parity. Original floating Config geometry
is supported from the source schema but awaits a real saved-original fixture.
Clipboard preview handling was app-tested; reading the real Windows clipboard
was not part of the automated fixture.
Stress testing is deferred by user instruction; focused meaningful regression
checks cover each milestone, including session ownership and Pueblo/MXP
clickable links, images and WHO spacing. No full fresh TLS or subjective audio
claim is inherited from an earlier preview.

### Source-only command reconciliation

The `IEquals(command, ...)` branches in original `Commands.cpp` additionally
include `/shelp`, `/makali`, `/lizards`, `/ai`, `/repeat`, `/debugtimers`,
`/stoplogs`, `/logtop`, `/stats`, `/world`, `/map_look`, `/map_guesslocation`,
`/mucknet`, `/restoreinfo`, `/removelast`, `/receivegmcp`, `/resetconfig`,
`/debugaliases`, `/rolltest`, `/test`, `/tilemap`, and the `/?` alias. The help
table also documents the `/silent/` prefix. These are open unless covered by a
later ledger entry; diagnostic commands are identified separately from daily
user actions. Their presence is not a request to reset user settings or contact
any server. `/quit` appears in the Markdown index but has no matching source
branch in this version and needs version-specific reconciliation.

## Preview 0.11 integration audit

- Atlas: all three original sample files retain complete semantic records through
  import/export/reimport, including maps, room/exit metadata, rectangles, cross-map
  links and dangling visual exits. Version 2 endpoint indices refer to ordered map
  children; version 1 uses room indices. Shared zoom/pan canvas and per-session
  position/tracking are implemented. Images/labels, full drawing/editing toolbar,
  native geometry parity and ambiguous room identification remain open.
- Triggers: next-line multiline child windows, line/time expiry, capture-only child
  processing and filtered termination, captured-group appearance, independent
  color/style whole-line flags, explicit style on/off, and click-only commands.
  Text-changing filter order still limits appearance/link ranges. Existing Pueblo
  and MXP links retain precedence. Font/hash/flash/paragraph actions, multiline
  send processing, untitled capture, full stats/avatar/activity actions and original
  shared cooldown semantics remain open. Current bounded engine limits are retained.
- Logging: native reviewed filename/date/environment substitutions, local file
  chooser, append, typed/sent prefixes, timestamps, wrapping/indent/double spacing,
  escaped styled HTML, beginning/visible-window starting points and character
  auto-start. One active file per session, midnight auto-file rotation and original
  numeric timestamp flags remain gaps; Restore.dat is separate and still open.
- Native build and all source modules pass. Fresh/persisted packaged acceptance
  passed at `sessions-20261012-081106`, including all new map, temporal,
  appearance/link, native logging, emoji and client-command checks. The
  trigger-editor overflow was corrected by moving child controls into their own
  tab. Emoji logging is checked against actual file bytes before replacement.
  Pueblo/MXP image/link/WHO checks passed. Final map-label visual review is
  recorded with the release evidence below.

### Preview 0.11 final package acceptance

Fresh and persisted launches passed at `sessions-20261012-082134`. Map labels
are measured in connected SVG elements even when their destination pane is built
offscreen; room labels wrap and clip, keep full-name tooltips, and choose readable
contrast. Fit includes exit bends and cross-map labels. The packaged layered-map
screenshot was inspected after this correction. All three original Atlas samples
pass full semantic import/export/reimport comparison. Native build and module
checks passed; Pueblo/MXP image/link/WHO fixtures passed on the 0.11 executable.
The source-derived command ordering audit identifies additional work for the next
preview, including alias ProcessCommands controls, escaped-command hooks, awaited
completion and cancellation after reconnection. These remain open in 0.11.

## Preview 0.12 integration audit

The screenshot-reported Pueblo login bug was reproduced from a fresh public
BoD greeting (no account login): SAMP rows contain BR plus LF outside PRE. The
parser now treats source line endings outside PRE as HTML whitespace while
preserving literal spaces/tabs. Explicit consecutive BR tags retain blank rows.
The Valyria parser provided the matching behavior; the MUSHclient chat confirmed
its earlier correction concerned image indentation rather than this bug.

Command dispatch now preserves full completion promises, owner FIFO/epochs,
hook provenance and bounded nested Run. Global original alias controls and
unknown-command behavior are imported and editable. Legacy recovery variable
alias behavior is explicit. Trigger Send accepts bounded multiline text and
awaits dispatch, but later rules are still precomputed: exact sound/send/filter/
script ordering and resumable trigger decisions remain open. The silent prefix
does not yet suppress every recovery handler's feedback. Raw script Send still
has a one-line native bridge bound; input prefixes and prompt pseudo-receive are
not complete original parity. Smart Paste keeps its reviewed processing checkbox.

Restoration stores structured snapshots, history and GMCP per character in a
separate bounded recovery format. Replay bypasses automation and automatic image
loading. Native storage preserves corrupt files until explicit Clear; writes are
atomic and batched within 500 ms. Original import requires exact current buffer
size and mapped character indices from the reviewed Config. Original files are
read-only. Original visual-rule/spawn replay is not implemented. Disabling pauses
capture and retains stored output, whereas original disable may delete its store.

Image history, shared dock/floating view controls, visible pause, inline geometry,
avatar minimum height and live metadata updates are implemented. Native Save
preserves original bytes and Copy produces the first-frame DIBV5. Supported direct
HTTP/S formats and bounds are in README. This does not claim exact missing native
ImageBanner/ImageAvatar internals or decoder-level animation suspension.

### Preview 0.12 final package acceptance

Fresh and persisted launches passed at `sessions-20261012-084624`. The Pueblo
spacing screenshot was inspected: ordinary login rows are consecutive, intentional
blank lines remain, and WHO columns and links are preserved. The image-viewer
screenshot was inspected after correcting control contrast. The session suite
checks command ownership/order, stale epoch cancellation, native saved-image and
clipboard-format bytes, per-character restoration files, replay isolation, reviewed
original import and settings persistence. The compiled Pueblo/MXP fixtures also
passed with ordinary HTML spacing, inline images, clickable commands and WHO rows.

## Preview 0.13 integration audit

Trigger evaluation yields at send/script boundaries and refreshes live variables,
away state and mutated text before child/later matching. Source order follows
Connection.cpp: sound/speech, Send, toast, filter, script. Full-match replacement
ranges update as in FindString; original captured-group ranges remain unchanged.
Spawn output uses final processed text. Owner/epoch/worker changes cancel pending
actions. Filters and explicit script edit records preserve unaffected links,
images and listeners; prose offsets exclude image captions and avatar decorations.

Remaining gaps include reentrant receive, synchronous cross-host script reads,
prompt pseudo-receive, all original actions, COM/filesystem/language compatibility
and original UTF-8 versus recovery UTF-16 indexing. Dynamic rule changes cancel
pending work. Safe snapshot restoration does not use the raw replay capability.

### Preview 0.13 final acceptance

Fresh and persisted packaged sessions passed at sessions-20261012-092530,
including the actual rule/script workers, exact native wire ownership, script
range styling, link/image identity, intercepted commands, alias/script Run effects
on later matching, and reconnect cancellation. The trigger-continuation screenshot
was inspected. The expanded suite retains individual worker/operation deadlines;
its total native watchdog is now 60 seconds.

Restart testing also exposed and corrected historical GMCP avatar instructions
leaking into a new live line. Snapshot replay now consumes historical one-line
instructions and restores any pre-existing live pending instruction/request state.
The image and restoration fixtures assert this boundary and decoded avatar geometry.
Native/module builds and compiled Pueblo/MXP image/link/WHO fixtures passed.

## Preview 0.14 integration audit

Global ANSI controls follow Root.prp, Dlg_Settings and AnsiParser, including the
fixed indexed-color table separate from the custom sixteen-color palette. Received
LF resets ANSI when enabled; Pueblo BR/P and CR alone do not. Original restore
records reset at their received-line boundary. MXP mode controls remain operational
when ANSI parsing is disabled, an explicit shared-parser compatibility choice.

/repeat, /gag, /grab, /tabcolor and /resetscript have source-derived bounded
implementations. Grab replies are offered to OnReceive first, then consumed before
triggers/logging/display/restore, with owner/epoch isolation and oversize rejection.
Gag changes global root rules; rebuilding cancels an old pending trigger tree.
Tab colors use safe opaque colors with an active tint and readable text; the exact
missing native named-color parser/theme behavior is not claimed. Script reset is
per owner rather than original process-wide. /roll and /exit remain open, as do
existing delay/recall differences and the complete command inventory.

## Preview 0.15 implementation scope

Additional input definitions use a bounded registry (16 panes per owner) and survive saved/copyable nested layouts; drafts remain per live owner and are not copied or saved. Original Type 0 InputWindow import, complete per-pane settings sharing, floating editing, exact shared primary/additional history navigation and multiline saved-history grouping remain open.

World encodings are bound atomically at connection start. Outgoing ordinary text and native login/templates convert through Windows code pages before Telnet IAC escaping. Raw GMCP/Telnet bytes bypass conversion. Existing recovery worlds migrate to UTF-8; original Config and new worlds default CP1252. Unknown original encodings require review. Automatic CHARSET negotiation, original malformed-UTF8 diagnostic wording and exact original server-dialog placement remain open.

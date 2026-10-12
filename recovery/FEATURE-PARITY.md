# BeipMU recovery feature inventory

For the current consolidated original-feature audit, use
[COMPLETION-CHECKLIST.md](COMPLETION-CHECKLIST.md). Historical milestone tables
below describe the state at those milestones; later implementations supersede
their gap lists. The 0.10 settings, nested layout, search and script-object
extensions have focused module coverage and a packaged acceptance fixture.
Full original parity remains open. Exact scripting membership is listed in
[SCRIPT-PARITY.md](SCRIPT-PARITY.md).

This inventory separates the published BeipMU client (`src/` and `Documentation/`)
from the current recovery worktree (`recovery/`). The original 4.335 executable was
inspected as a UI reference; it is not included in the recovery build.
"Verified" below means focused tests or an app fixture passed for the stated
subset. Version labels identify the verified milestone; they do not mean full
upstream compatibility.

| Feature | Original BeipMU behavior | Recovery status |
| --- | --- | --- |
| Desktop layout | Bottom-left popup, output/input panes, bottom session tabs and activity indicators | **0.4 app fixture verified:** native Windows/Tools/Logging/Settings/Help/Exit popup, black output and input, resizable command pane, and tabs/activity on one bottom row. Worlds and supported feature editors follow the directly inspected original 4.335 dialog layouts. **0.5 app fixture verified:** right-side session panes with keyboard resizing; 0.6 adds independent native floating panes and Dock actions; 0.8 adds caption and group dragging across four edges. |
| Connections and output | Multiple worlds/characters, telnet, configurable sessions, ANSI text | **0.3 app fixture verified:** two concurrent telnet sessions with independent output and command routing. The 0.2 baseline supported one plain TCP connection. |
| Pueblo/MXP | Pueblo plus MXP support, clickable commands, images and text formatting | Preview 0.3 retains the documented Pueblo and explicit MXP subset, with parser and local-server tests. Full MXP remains open. |
| World profiles | Server and character entries, connect strings, notes, per-profile rules and logging | **0.3 app fixture verified:** saved world/character labels, startup choices, settings persistence, scoped rules, and character-bound login with a password kept in Windows Credential Manager. The test-mode vault is memory-only; wrong-character and unapproved plain-TCP login attempts were rejected. **0.5 app fixture verified:** one character's notes saved and reloaded without appearing in another's pane. Original connect templates and complete per-profile behavior remain open. |
| TLS | Secure server connections | **0.3 full-app fixture verified:** Schannel transport with system trust and hostname checks. Local trusted, untrusted and wrong-host certificate tests also passed. |
| Aliases | Ordered global/server/character aliases, simple or regex replacement, capture substitutions, multi-line output, folders, variables, processing options | **0.3 app fixture verified subset:** ordered scopes, simple/wildcard and worker-isolated regex captures, `\0`/`\1` replacement, multi-line output and bounded command expansion. 0.9 preserves nested imported trees and pre/post scope ordering, and adds character variables with selected expansion. Complete original internal-command ordering remains open. |
| Triggers | Ordered global/server/character triggers, regex or simple matching, appearance, filtering, gagging, send, spawn, toast, sound, speech, scripts, children and multi-line capture | **0.3 app fixture verified subset:** completed-line simple/wildcard and worker-isolated regex matching, captures, commands, highlight, gag, spawn and notification actions. **0.5 app fixture verified:** original-style editor saves a description without losing enabled/copy/send/highlight fields; grouped spawn, capture-until, filtered spawn text, move/copy, log-gag and manual capture cancellation work in the supported subset. 0.9 adds Away/Present and once-per-away conditions, repeated matches, native WAV/speech and nested Config import. Multiline child windows, advanced appearance and complete original action compatibility remain open. |
| Spawn windows | Named panes, capture-until, grouped tabs, docking/floating | **0.5 app fixture verified subset:** named and grouped streams appear in a session dock; a WHO-like start/body/end sequence moves to the grouped stream, then following output resumes in the main view. The copy option retains a matched line in main output. 0.6 adds native floating panes; full 0.8 adds caption and group dragging across four edges. |
| Keyboard shortcuts and macros | Remappable application shortcuts and per-world macros | **0.3 app fixture verified subset:** scoped keyboard macros and command history. **0.5 app fixture verified:** session history pane, entry recall, and Ctrl+Down saving a draft without sending it. 0.6 adds remapping of supported application actions. |
| Logging | Manual and automatic per-character logs, date naming, log from scrollback | **0.3 app fixture verified subset:** start/stop session logs, local log files and transcript export. **0.5 app fixture verified:** restarting a log from the beginning includes existing scrollback; captured lines marked log-gag are absent. Original per-character naming and full lifecycle options remain open. |
| Scripting | JavaScript startup and immediate mode, trigger functions, application objects | **0.3 app fixture verified subset:** opt-in worker JavaScript with startup/immediate execution, line/GMCP callbacks, bounded effects and execution timeout. 0.6 adds send/receive suppression, raw GMCP callbacks, named trigger functions, window userdata, connection Display/Transmit, bounded timers and script error output. 0.7 adds input controls, character collections, window titles, debug output and command callbacks. Native COM/filesystem and the complete application object model remain open. |
| GMCP | Core.Hello/Supports and `Beip.Stats`, `Beip.Tilemap`, `Beip.Id`, `Client.Media` | **0.3 app fixture verified subset:** telnet GMCP negotiation, Core.Hello/Supports, `Beip.Stats` and `Beip.Id`; incoming `Beip.Tilemap` and `Client.Media` messages reach their browser modules. Core.Supports advertises Stats, Tilemap, Id and Client.Media version 1. |
| Mapping | Interactive atlas with rooms, exits, route finding, editing | **0.3 app fixture verified subset:** per-world rooms, coordinates, directed exits and shortest routes; browser map dialog creates and edits two rooms, adds an exit, marks the current room, displays the `n` route, and persists the graph. 0.6 adds reviewed XML/ZIP Atlas import. 0.7 adds single-map Atlas export with supported room and exit metadata. Multiple layers, drawings and automatic location tracking remain open. |
| Client commands and Smart Paste | Documented slash commands, delayed sends, multiline clipboard/file sending with pace and affixes | **0.5 app fixture verified subset:** `/delay` sends on its originating session after the active tab changes, cancellation prevents a pending send, and Smart Paste sends two paced prefixed/suffixed lines only to its originating session. Module tests cover the broader implemented command subset and paste validation. Complete original command vocabulary and dialog behavior remain open. |
| Stat windows | Text/range/progress displays and updates | **0.3 app fixture verified subset:** `Beip.Stats` text, range and progress display. Richer original layout behavior remains open. |
| Client.Media | Default/Load/Play/Stop; name-based sound playback | **Partial browser fixture verified:** incoming `Default` and `Load` messages set the media base and cache a name while playback stays disabled by default. Isolated module tests cover `Play`, `Stop`, volume and loops. Browser audio playback still needs checking. |
| Beip.Tilemap | Info/data updates with hex and base64 encodings and map windows | **0.3 app fixture verified subset:** incoming Info/Data loads an HTTP tileset and renders a two-tile red/blue canvas in the browser; decoded tiles and canvas dimensions are asserted and the screenshot was inspected. Isolated tests cover `hex_4`, `hex_8`, `base64_8`, `zbase64_8`, partial updates and safety limits. Original maximum map size is reduced. |
| Media and accessibility | Sounds, speech, avatars, web views and rich display options | **0.3 app fixture verified subset:** inline images and a GMCP line avatar load and display in the browser. 0.9 adds local WAV playback and plain-text Windows speech; voice selection, SAPI XML, web views and richer display options remain open. |

The 0.5 packaged-app fixture in `tests/session_test.py` passed on a fresh launch
and a persisted relaunch. It runs two independent local
telnet servers and a local image server against the packaged WebView app. It
checks visual GMCP state, mapper and dock controls, grouped spawn capture,
history and notes isolation, delayed and pasted command routing, log files,
rule actions, scripts, saved-login boundaries, and persisted settings. Its image
uses synthetic red/blue tiles, and its saved password is a synthetic test
value held only in the native test-mode memory vault. The fixture verifies
browser display and command routing, not complete original feature parity.

## 0.5 integration and remaining behavior

The 0.5 worktree adds original-style docked panes and deeper rule handling.
The table below states what the packaged app fixture verified and what still
remains outside this slice.

| Area | Original behavior to compare | 0.5 verified behavior | Remaining gap after this slice |
| --- | --- | --- | --- |
| Docked panes | Original window menu can show history, map, image and character-notes panes; panes can be docked and grouped | Native actions opened the supported panes; the map rendered two saved rooms, the dock resized by keyboard, and another character's pane state stayed separate | Full drag docking and copied layouts; recovery saves which pane types are open per character, but not an original-compatible arrangement |
| History and command input | History window shows sent commands; Ctrl+Up/Down recalls them; Ctrl+Down can save a draft without sending | Two sent lines appeared in their originating session's history; clicking a row recalled it, while Ctrl+Down saved an unsent draft | The complete original history search interface and all original editing rules |
| Output split and image | Original output can split for scrollback; the image window displays separate imagery | A split pane reflected only one session's visible lines; the image pane loaded a real local test image | Original pane persistence, media controls and complete image window options |
| Character notes | Notes belong to a selected character profile | A note saved for one character survived the persisted relaunch and did not appear for another character | Original note formatting and every profile inheritance behavior |
| Rules | Original aliases and triggers offer nested processing, folders, variables, conditions and richer actions | The app fixture exercised capture-until, grouping, move/copy, filtered text, log-gag, manual cancellation and an editor save; module tests cover bounds and disabled behavior | Features not explicitly modeled or tested remain open, particularly original script and action compatibility |
| Client commands and Smart Paste | Delayed session commands and paced sending of clipboard or file lines | A delayed command and two paced paste lines reached the originating connection after another tab became active; cancel prevented a second delayed send | Complete original command vocabulary, clipboard selection flow, and all paste options |

Remaining high-value gaps include free drag docking and arbitrary nested pane
arrangements, nested rules and variables, additional trigger actions, complete
per-profile settings inheritance, original connect templates and log naming,
and the complete original scripting object model. Remappable supported
shortcuts, selection copy, Pause and native floating panes are implemented in
the earlier slices; they no longer belong in the unimplemented list.

## Rules contract in this recovery branch

`recovery/ui/rules.js` exposes `window.BeipRules` and CommonJS `require()` with
`createEngine({ aliases, triggers, limits? })`. An engine offers
`expandCommand(input, { serverId, characterId })` and
`processLine(plainText, { serverId, characterId }, nowMs?)`. Both return data;
neither sends to a server, edits the page, or evaluates code. The caller chooses
how to apply action records. `processLine` accepts only a completed plain-text
line, not a partially parsed protocol stream.

Rules use `enabled` (default true), `scope: { level: 'global' | 'server' |
'character', serverId?, characterId? }`, `match`, and `matchType` (`simple` by
default, `exact` or `wildcard`). In this subset, `simple` matches substrings;
`exact` matches an entire line; `wildcard` matches an entire line with `*`
captures and `?` single-character slots. Wildcard captures are numbered by
asterisk order. This is intentionally distinct from the original regex feature;
existing regex patterns must not be silently treated as compatible wildcard
patterns. Rule order is global, server, then character, preserving order within
each scope. The 0.3 app runs regular-expression rules in a dedicated worker
through `BeipRegexRules.Runtime`, which stops jobs that exceed 500 ms. The
default synchronous engine ignores regex rules. The original also permits
configurable pre/post ordering, implemented in 0.9; 0.8 adds bounded nested processing.

Alias fields include `replacement`, `matchCase`, and `stopProcessing`. A
replacement can use BeipMU's `\0` for the full match and `\1`–`\9` for captures.
`\\` inserts a literal backslash. Multiple replacement lines become separate
commands. The engine processes each rule once in order; it does not restart
alias matching on generated commands.

Trigger fields include `lineStart`, `lineEnd`, `wholeWord`, `cooldownMs`, `once`,
`stopProcessing`, `sendText`, `highlight`, `gag`, `logGag`, `spawnTitle`,
`spawnGroup`, `spawnCopy`, `spawnGagLog`, `captureUntil`, `notify`, and
`filterText`. A hit may return `command`, `highlight`, `spawn`, and
`notification` actions plus captures and display/log gag flags. Without
`spawnCopy`, matched and captured lines move out of the main output.
`captureUntil` runs only in the isolated regex worker, is scoped to a
server/character, and stops after the matching line, 200 continuation lines,
or five seconds. The caller
must never feed a returned trigger command back into alias or trigger processing
without its own explicit, bounded policy.

The engine caps rule count, pattern and line length, replacement count, action
count, output size, and number of generated commands. User regex and opt-in
JavaScript run in separate, time-bounded workers in the 0.3 app. These workers
return bounded commands and display effects to the caller; neither owns the
native connection. Original script API compatibility remains incomplete.

`recovery/ui/media.js` exposes `BeipMedia.createController({ AudioClass?, enabled? })`.
Its controller accepts `handle(packageName, parsedPayload)`, `setEnabled(boolean)`,
`stopAll()`, and `snapshot()`. Media names are resolved beneath a validated
HTTP(S) base URL. At most 16 tracks can play and 32 names are cached. `loops:-1`
is the documented indefinite-loop value; disabling sound stops playback.

`recovery/ui/tilemap.js` exposes `BeipTilemap.createState({ inflate? })`. Its
state accepts asynchronous `apply(packageName, parsedPayload)`, `get(name)`,
`list()`, and `render(canvas, name, loadedImage)`. The caller supplies a loaded
tileset image; the module does not fetch one. Maps are limited to eight names,
16,384 cells, and 4,096 pixels per canvas dimension. Invalid updates leave the
previous map intact.

`recovery/ui/mapper.js` exposes `BeipMapper.createWorld(initial?)` for one world
at a time. Rooms have stable IDs, titles, and integer coordinates; directed
exits have stable IDs, endpoints, and one-line commands. Its editor methods,
`shortestPath(targetId)`, `walkCommands(targetId)`, and `serialize()` operate
only on local graph state. The caller must send returned walk commands only
after an explicit user action. `normalize()` rejects invalid persisted maps,
with limits of 1,024 rooms and 4,096 exits. This is the route and room data
foundation. `classic-import-core.js` reads bounded original XML/ZIP `.atlas` files; 0.7 adds reviewed single-map Atlas export with supported metadata retention.

References: [Aliases](../Documentation/Aliases.md),
[Triggers](../Documentation/Triggers.md),
[Spawn Windows](../Documentation/SpawnWindows.md),
[Shortcuts](../Documentation/Shortcuts.md),
[Scripting](../Documentation/Scripting.md),
[GMCP](../Documentation/GMCP.md),
[Tilemap format](../TileMap.md), and the
[recovery notes](README.md).


## Preview 0.6 compatibility boundaries

Floating panes are owned Windows windows with separate restricted WebViews.
Snapshots contain semantic data and bounded text; panel events return through
the owning window identity. The supported pane types are map, input history,
images, notes, split output and spawn output. Floating split output preserves bounded styles and command/URL links. Floating
spawn output uses plain text snapshots; docked views retain richer original DOM. Free drag
rearrangement and copied original docking layouts remain incomplete.

Original Config.txt imports the supported subset after a category review.
Passwords, connect strings and script-like actions are omitted. Imported
profiles receive fresh identities. Atlas maps support plain XML and Deflate ZIP
Atlas.xml with CRC and expansion limits. Shipped Fluff, FurryMUCK and Arx files
are covered by tests. Arx has unresolved references that are reported; map
layers/drawings and all original exit metadata cannot be represented.

Shortcut overrides persist inside allowlisted preferences. Unsupported original
actions are not offered. Script callbacks and trigger functions run in a
session-owned disposable worker, with execution, queue, effect and timer limits.
Filesystem/COM/native UI scripting is outside this preview's supported API.

0.6 packaged acceptance passed on a fresh launch and a persisted second launch
(`sessions-20261011-232953`). Both phases verified floating history through a
real native child WebView with rendered acknowledgment and screenshot, Dock,
restored layouts and zero live floating windows after session cleanup; moved
Ctrl+U to Ctrl+K and checked the old binding no longer clears input; exercised
review/apply Config.txt and compressed Atlas imports; and checked script
startup, send/receive suppression, named trigger ranges, session timers,
watchdog/debug output, worker restrictions and per-session command routing.
These checks establish the supported subset; they do not establish complete
original BeipMU feature or visual parity.

## Preview 0.7 scope

Pane layouts support left/right/top/bottom groups, edge-specific sizes, and an
internal Copy/Paste all window settings action. Input History defaults below
the main output; Image Window defaults above it. Floating panes remain native
Windows windows. This supports the original arrangement workflow, while free
drag docking, arbitrary splits and copied original preference groups remain open.

Atlas export creates a bounded ZIP containing one Atlas.xml. It retains supported
room rectangles, fill/outline colors, text angles, construction flags and exit
bend points/pair relationships. Map names and colors persist. Multiple map layers,
cross-map links, embedded images and arbitrary drawings remain outside the graph.
Export review identifies this scope before saving.

Scripting adds session-owned input text and selection effects, read-only character
collections and window titles, debug output, and slash-command callbacks before
built-in command handling. These are bounded compatibility APIs; native COM,
filesystem and cross-session mutation remain unsupported.

0.7 packaged acceptance passed on fresh and persisted launches
(`sessions-20261011-234930`), including four-edge movement/resizing, copied
layouts with separate session content, native floating-pane lifecycle, script
input/selection and live timer context, Atlas save-byte verification through
Python ZIP/XML readers, and reviewed browser reimport. Pueblo/MXP image/link
and WHO-spacing fixtures also passed. Browser and native screenshots were inspected.

## Preview 0.8 scope

Caption drags move the selected supported pane; an edge grip moves its docked group.
Blue targets preview left/right/top/bottom placement. Escape, outside drops,
Control and session switches cancel the drag. Floating windows keep their owner.
Arbitrary nested splits and dragging between native windows remain open.

Nested aliases/triggers use up to 128 entries and eight levels. Folders gate their
subtree; children inherit the root scope. Alias children process the replaced
command; trigger children process the whole processed line, as in Connection.cpp.
Children execute before parent stop, and child stop propagates. Invalid ancestry
is removed without promoting children or disabling unrelated valid roots.

Supported output/input preferences resolve global, world, then character settings.
Original BeipMU defaults character settings directly to global settings. The world
layer, retaining dormant overrides, sparse per-field fallback, and including input
height in input inheritance are explicit recovery adaptations. Config.txt imports
supported MainWindowSettings Output/Input and InputSize fields; unchecked preference
imports leave these overrides out. Rich original font/color/output settings remain open.

0.8 module/native build checks and two-phase packaged acceptance passed
(`sessions-20261012-063705`). Hierarchy editor and worker checks, scoped setting
save/reopen/cancel, original import category selection, and invalid ancestry
regressions passed. Browser pointer drag checks and Pueblo/MXP packaged image,
command-link and WHO-spacing checks passed; screenshots were inspected.


## Preview 0.9 automation compatibility

Original source traversal is global pre, world pre, character, world post,
global post. Root rules expose that choice; children always run in source order.
Existing recovery rules retain their previous defaults. Imported original
`AfterCount`, nested rules, disabled trigger folders and container activation
are converted explicitly; child identities are remapped when the review is applied.
Original multiline child windows and capture-only child subtrees are omitted and
reported, because flattening them would change when commands fire.

The trigger engine now supports every match or once per line, Away/Present and
once while away (shared across qualifying rules for that connection, reset on
activation changes). Away means another session is selected or the main WebView
has lost focus. A floating pane does not currently make its owner present.
The old recovery `once` setting still means once until the rule engine reloads.
Character variables are case-sensitive; unknown names stop further expansion,
and expanded values are not recursively expanded. Names are limited to 128
characters, values to 4,096, and each character to 128 variables/64 KiB.
Same-line `/set` and `/unset` effects feed following trigger actions; completed
lines apply their effects in order before the next line takes its variable snapshot.
Only these variable commands are processed internally from alias/trigger output;
the full original command-processing pipeline remains incomplete.

Trigger audio uses explicitly enabled application playback, reviewed configured
local WAV paths, and plain-text SAPI. The native host checks registered session
ownership and rejects network/device paths, invalid WAV headers and files over
32 MiB. One WAV channel replaces the previous WAV; speech has eight owner voices,
eight pending utterances per owner and 2,048 characters per utterance. Sound API
acceptance and SAPI start/end events are observable; these do not establish what
a listener heard through their selected output device. Browser Client.Media
playback remains a separate, previously unverified claim.

For 0.9, the full Windows/native-module build and packaged two-launch session
fixture passed (`sessions-20261012-070038`). It verifies original nested imports
and remapped identities through real session workers, pre/post ordering,
character variables and wire isolation, Away context, Sound editor persistence
and visibility, and actual WAV API acceptance plus matching SAPI queued/start/end
events. Negative playback assertions wait for native completion barriers; delayed
worker results and a final partial line cannot restart audio after disconnect.
The Sound editor screenshot was inspected. The standalone native audio fixture
also passed queue bounds and owner-specific stopping. Pueblo/MXP image, command
link and WHO-spacing fixtures passed. TLS code is unchanged; no fresh complete
TLS verification or subjective listening verification is claimed.

## Preview 0.11 source comparison

The current checklist and README describe this milestone. Reference evidence:
`Connection.cpp` multiline/capture processing and style/click ranges;
`Logging.cpp` filename expansion and formatted records; `Commands.cpp` client
commands; `Root.prp` and settings dialogs; original `Assets/Emoji.txt`; and all
three bundled Atlas sample files. Original `src/` remains unchanged.

Atlas v1 uses room ordinal endpoints, while v2 uses ordered map-child indices.
The tests compare complete semantic roundtrips on Fluff (3 maps/96 rooms/134
exits), FurryMUCK (2/237/240 plus 7 rectangles) and Arx (1/442/573 plus 17
rectangles). A dangling Arx exit remains as geometry, not a fabricated route.

Temporal, appearance, logging, emoji and command fixture details are maintained
with the packaged session acceptance. They establish specific supported behavior,
not exhaustive parity with the original executable. Restore.dat, image controls,
full command/alias flag ordering and other open rows remain separate work.

## Preview 0.12 source comparison

Pueblo HTML now folds source newlines outside PRE; BR retains the visible break,
literal spaces/tabs retain columns, and PRE/plain/MXP line handling stays separate.
This fixes the reproduced public BoD login spacing reported by the user.

Command queues carry session identity and connection epoch through awaited alias
workers and hooks, with explicit nested continuation contexts. Source comparison
follows Wnd_Main::SendLines/SendLine, ParseCommand and Connection::Send rather
than treating every string as the same send path. Original global alias flags are
available; remaining trigger continuation and native script gaps stay open.

Restoration and image controls are implemented subsets as described in the current
COMPLETION-CHECKLIST. Recovery snapshot replay intentionally avoids automation,
and original Restore.dat import is read-only and requires reviewed slot metadata.
Image native Save/Copy uses bounded system decoding and preserves session ownership.

## Preview 0.13 source comparison

Connection.cpp 1826–1948 supplies trigger action order. FindString.h 20–24 updates
only the full-match end after a replacement; captured-group ranges are unchanged.
Connection.cpp 1304 onward supplies spawn's final processed line. Recovery now
uses resumable rules and awaited command/script effects instead of precomputing
all later matches or simulating variable commands. Incremental range edits retain
unaffected interactive nodes. This does not close the scripting architecture gaps
listed in SCRIPT-PARITY.

## Preview 0.14 source comparison

ANSI Root.prp 381-427 and Dlg_Settings 589-756 define original palette/policies.
Telnet.cpp 395-396 discards CR and emits received lines on LF; TextToLine 21 resets
ANSI per such line. The recovery preserves its Pueblo whitespace fix separately.
Commands.cpp supplies WordList, repeat, gag, grab and tabcolor semantics; missing
native parsing dependencies and isolated scripting architecture are recorded as
limits rather than treating matching command names as full compatibility.

### Preview 0.14 acceptance evidence

Windows/native build and all 43 JavaScript test modules pass, including 14 ANSI and 25 daily-command checks. Fresh and persisted packaged sessions pass at `sessions-20261012-094157`. These verify live ANSI settings, computed styles and line resets, settings Save/reopen/Cancel, repeated native command ownership, four one-shot grab requests, OnReceive ordering, hidden partial replies, no captured reply in transcript/log/dock/restore, global gag, owner script reset, silent command feedback and saved tab colors. Compiled Pueblo/MXP image/link/WHO/ordinary-spacing fixtures also pass. ANSI settings and rendered output screenshots were inspected. The local server fixture uses a non-consuming line boundary so consecutive grab commands each receive one reply.

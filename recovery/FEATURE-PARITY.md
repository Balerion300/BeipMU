# BeipMU recovery feature inventory

This inventory separates the published BeipMU client (`src/` and `Documentation/`)
from the 0.5 recovery worktree (`recovery/`). The original 4.335 executable was
inspected as a UI reference; it is not included in the recovery build.
"Verified" below means focused tests or an app fixture passed for the stated
subset. Version labels identify the verified milestone; they do not mean full
upstream compatibility.

| Feature | Original BeipMU behavior | Recovery status |
| --- | --- | --- |
| Desktop layout | Bottom-left popup, output/input panes, bottom session tabs and activity indicators | **0.4 app fixture verified:** native Windows/Tools/Logging/Settings/Help/Exit popup, black output and input, resizable command pane, and tabs/activity on one bottom row. Worlds and supported feature editors follow the directly inspected original 4.335 dialog layouts. **0.5 app fixture verified:** right-side session panes with keyboard resizing; free drag docking and floating remain open. |
| Connections and output | Multiple worlds/characters, telnet, configurable sessions, ANSI text | **0.3 app fixture verified:** two concurrent telnet sessions with independent output and command routing. The 0.2 baseline supported one plain TCP connection. |
| Pueblo/MXP | Pueblo plus MXP support, clickable commands, images and text formatting | Preview 0.3 retains the documented Pueblo and explicit MXP subset, with parser and local-server tests. Full MXP remains open. |
| World profiles | Server and character entries, connect strings, notes, per-profile rules and logging | **0.3 app fixture verified:** saved world/character labels, startup choices, settings persistence, scoped rules, and character-bound login with a password kept in Windows Credential Manager. The test-mode vault is memory-only; wrong-character and unapproved plain-TCP login attempts were rejected. **0.5 app fixture verified:** one character's notes saved and reloaded without appearing in another's pane. Original connect templates and complete per-profile behavior remain open. |
| TLS | Secure server connections | **0.3 full-app fixture verified:** Schannel transport with system trust and hostname checks. Local trusted, untrusted and wrong-host certificate tests also passed. |
| Aliases | Ordered global/server/character aliases, simple or regex replacement, capture substitutions, multi-line output, folders, variables, processing options | **0.3 app fixture verified subset:** ordered scopes, simple/wildcard and worker-isolated regex captures, `\0`/`\1` replacement, multi-line output and bounded command expansion. Folders, variables and complete internal-command ordering remain open. |
| Triggers | Ordered global/server/character triggers, regex or simple matching, appearance, filtering, gagging, send, spawn, toast, sound, speech, scripts, children and multi-line capture | **0.3 app fixture verified subset:** completed-line simple/wildcard and worker-isolated regex matching, captures, commands, highlight, gag, spawn and notification actions. **0.5 app fixture verified:** original-style editor saves a description without losing enabled/copy/send/highlight fields; grouped spawn, capture-until, filtered spawn text, move/copy, log-gag and manual capture cancellation work in the supported subset. Child processing, focus conditions, sound/speech and advanced appearance remain open. |
| Spawn windows | Named panes, capture-until, grouped tabs, docking/floating | **0.5 app fixture verified subset:** named and grouped streams appear in a session dock; a WHO-like start/body/end sequence moves to the grouped stream, then following output resumes in the main view. The copy option retains a matched line in main output. Floating and full docking remain open. |
| Keyboard shortcuts and macros | Remappable application shortcuts and per-world macros | **0.3 app fixture verified subset:** scoped keyboard macros and command history. **0.5 app fixture verified:** session history pane, entry recall, and Ctrl+Down saving a draft without sending it. Full shortcut remapping remains open. |
| Logging | Manual and automatic per-character logs, date naming, log from scrollback | **0.3 app fixture verified subset:** start/stop session logs, local log files and transcript export. **0.5 app fixture verified:** restarting a log from the beginning includes existing scrollback; captured lines marked log-gag are absent. Original per-character naming and full lifecycle options remain open. |
| Scripting | JavaScript startup and immediate mode, trigger functions, application objects | **0.3 app fixture verified subset:** opt-in worker JavaScript with startup/immediate execution, line/GMCP callbacks, bounded effects and execution timeout. The original application object API remains largely open. |
| GMCP | Core.Hello/Supports and `Beip.Stats`, `Beip.Tilemap`, `Beip.Id`, `Client.Media` | **0.3 app fixture verified subset:** telnet GMCP negotiation, Core.Hello/Supports, `Beip.Stats` and `Beip.Id`; incoming `Beip.Tilemap` and `Client.Media` messages reach their browser modules. Core.Supports advertises Stats, Tilemap, Id and Client.Media version 1. |
| Mapping | Interactive atlas with rooms, exits, route finding, editing | **0.3 app fixture verified subset:** per-world rooms, coordinates, directed exits and shortest routes; browser map dialog creates and edits two rooms, adds an exit, marks the current room, displays the `n` route, and persists the graph. Atlas import/export, map layers, path highlighting, and automatic location tracking remain open. |
| Client commands and Smart Paste | Documented slash commands, delayed sends, multiline clipboard/file sending with pace and affixes | **0.5 app fixture verified subset:** `/delay` sends on its originating session after the active tab changes, cancellation prevents a pending send, and Smart Paste sends two paced prefixed/suffixed lines only to its originating session. Module tests cover the broader implemented command subset and paste validation. Complete original command vocabulary and dialog behavior remain open. |
| Stat windows | Text/range/progress displays and updates | **0.3 app fixture verified subset:** `Beip.Stats` text, range and progress display. Richer original layout behavior remains open. |
| Client.Media | Default/Load/Play/Stop; name-based sound playback | **Partial browser fixture verified:** incoming `Default` and `Load` messages set the media base and cache a name while playback stays disabled by default. Isolated module tests cover `Play`, `Stop`, volume and loops. Browser audio playback still needs checking. |
| Beip.Tilemap | Info/data updates with hex and base64 encodings and map windows | **0.3 app fixture verified subset:** incoming Info/Data loads an HTTP tileset and renders a two-tile red/blue canvas in the browser; decoded tiles and canvas dimensions are asserted and the screenshot was inspected. Isolated tests cover `hex_4`, `hex_8`, `base64_8`, `zbase64_8`, partial updates and safety limits. Original maximum map size is reduced. |
| Media and accessibility | Sounds, speech, avatars, web views and rich display options | **0.3 app fixture verified subset:** inline images and a GMCP line avatar load and display in the browser. Speech, web views, richer display options and actual audio playback remain open. |

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
| Docked panes | Original window menu can show history, map, image and character-notes panes; panes can be docked and grouped | Native actions opened the supported panes; the map rendered two saved rooms, the dock resized by keyboard, and another character's pane state stayed separate | Full drag docking, floating windows and copied layouts; recovery saves which pane types are open per character, but not an original-compatible arrangement |
| History and command input | History window shows sent commands; Ctrl+Up/Down recalls them; Ctrl+Down can save a draft without sending | Two sent lines appeared in their originating session's history; clicking a row recalled it, while Ctrl+Down saved an unsent draft | Remappable shortcuts, original history search interface and all original editing rules |
| Output split and image | Original output can split for scrollback; the image window displays separate imagery | A split pane reflected only one session's visible lines; the image pane loaded a real local test image | Original pane persistence, media controls and complete image window options |
| Character notes | Notes belong to a selected character profile | A note saved for one character survived the persisted relaunch and did not appear for another character | Original note formatting and every profile inheritance behavior |
| Rules | Original aliases and triggers offer nested processing, folders, variables, conditions and richer actions | The app fixture exercised capture-until, grouping, move/copy, filtered text, log-gag, manual cancellation and an editor save; module tests cover bounds and disabled behavior | Features not explicitly modeled or tested remain open, particularly original script and action compatibility |
| Client commands and Smart Paste | Delayed session commands and paced sending of clipboard or file lines | A delayed command and two paced paste lines reached the originating connection after another tab became active; cancel prevented a second delayed send | Complete original command vocabulary, clipboard selection flow, and all paste options |

The highest-value documented gaps beyond this slice are the original flexible
docking and floating-window layout, nested rules, variables and additional
trigger actions ([Triggers](../Documentation/Triggers.md)); remappable built-in
shortcuts ([Shortcuts](../Documentation/Shortcuts.md)); and automatic selection
copy plus the complete Pause behavior ([Getting Started](../Documentation/GettingStarted.md)).
The 0.5 Smart Paste and capture-until work address supported subsets of those
features; they do not imply full original compatibility.

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
configurable pre/post and nested rule ordering, which remains open.

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
foundation; it does not read or write `.atlas` files.

References: [Aliases](../Documentation/Aliases.md),
[Triggers](../Documentation/Triggers.md),
[Spawn Windows](../Documentation/SpawnWindows.md),
[Shortcuts](../Documentation/Shortcuts.md),
[Scripting](../Documentation/Scripting.md),
[GMCP](../Documentation/GMCP.md),
[Tilemap format](../TileMap.md), and the
[recovery notes](README.md).

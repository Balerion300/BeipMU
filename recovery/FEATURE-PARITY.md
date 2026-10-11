# BeipMU recovery feature inventory

This inventory separates the published BeipMU client (`src/` and `Documentation/`)
from the recovered 0.4 build (`recovery/`). The original executable is not
recovered by this work. “Verified” below means focused tests or an app fixture
passed for the stated subset; it does not mean full upstream compatibility.

| Feature | Original BeipMU behavior | Recovery status |
| --- | --- | --- |
| Desktop layout | Bottom-left popup, output/input panes, bottom session tabs and activity indicators | **0.4:** native Windows/Tools/Logging/Settings/Help/Exit popup, black output and input, resizable command pane, and tabs/activity on one bottom row. Worlds and supported feature editors follow the directly inspected original 4.335 dialog layouts. Full original docking remains open. |
| Connections and output | Multiple worlds/characters, telnet, configurable sessions, ANSI text | **0.3 app fixture verified:** two concurrent telnet sessions with independent output and command routing. The 0.2 baseline supported one plain TCP connection. |
| Pueblo/MXP | Pueblo plus MXP support, clickable commands, images and text formatting | Preview 0.3 retains the documented Pueblo and explicit MXP subset, with parser and local-server tests. Full MXP remains open. |
| World profiles | Server and character entries, connect strings, notes, per-profile rules and logging | **0.3 app fixture verified:** saved world/character labels, startup choices, settings persistence, scoped rules, and character-bound login with a password kept in Windows Credential Manager. The test-mode vault is memory-only; wrong-character and unapproved plain-TCP login attempts were rejected. Original connect templates, notes, and complete per-profile behavior remain open. |
| TLS | Secure server connections | **0.3 full-app fixture verified:** Schannel transport with system trust and hostname checks. Local trusted, untrusted and wrong-host certificate tests also passed. |
| Aliases | Ordered global/server/character aliases, simple or regex replacement, capture substitutions, multi-line output, folders, variables, processing options | **0.3 app fixture verified subset:** ordered scopes, simple/wildcard and worker-isolated regex captures, `\0`/`\1` replacement, multi-line output and bounded command expansion. Folders, variables and complete internal-command ordering remain open. |
| Triggers | Ordered global/server/character triggers, regex or simple matching, appearance, filtering, gagging, send, spawn, toast, sound, speech, scripts, children and multi-line capture | **0.3 app fixture verified subset:** completed-line simple/wildcard and worker-isolated regex matching, captures, commands, highlight, gag, spawn and notification actions. Child/multi-line processing, focus conditions, sound/speech and advanced appearance remain open. |
| Spawn windows | Named panes, capture-until, grouped tabs, docking/floating | **0.3 app fixture verified subset:** a trigger can route a matched line to a named pane. Persistent capture, grouping and docking remain open. |
| Keyboard shortcuts and macros | Remappable application shortcuts and per-world macros | **0.3 app fixture verified subset:** scoped keyboard macros and command history. Full shortcut remapping remains open. |
| Logging | Manual and automatic per-character logs, date naming, log from scrollback | **0.3 app fixture verified subset:** start/stop session logs, local log files and transcript export. Original per-character naming, log-from-scrollback and full lifecycle options remain open. |
| Scripting | JavaScript startup and immediate mode, trigger functions, application objects | **0.3 app fixture verified subset:** opt-in worker JavaScript with startup/immediate execution, line/GMCP callbacks, bounded effects and execution timeout. The original application object API remains largely open. |
| GMCP | Core.Hello/Supports and `Beip.Stats`, `Beip.Tilemap`, `Beip.Id`, `Client.Media` | **0.3 app fixture verified subset:** telnet GMCP negotiation, Core.Hello/Supports, `Beip.Stats` and `Beip.Id`; incoming `Beip.Tilemap` and `Client.Media` messages reach their browser modules. Core.Supports advertises Stats, Tilemap, Id and Client.Media version 1. |
| Mapping | Interactive atlas with rooms, exits, route finding, editing | **0.3 app fixture verified subset:** per-world rooms, coordinates, directed exits and shortest routes; browser map dialog creates and edits two rooms, adds an exit, marks the current room, displays the `n` route, and persists the graph. Atlas import/export, map layers, path highlighting, and automatic location tracking remain open. |
| Stat windows | Text/range/progress displays and updates | **0.3 app fixture verified subset:** `Beip.Stats` text, range and progress display. Richer original layout behavior remains open. |
| Client.Media | Default/Load/Play/Stop; name-based sound playback | **Partial browser fixture verified:** incoming `Default` and `Load` messages set the media base and cache a name while playback stays disabled by default. Isolated module tests cover `Play`, `Stop`, volume and loops. Browser audio playback still needs checking. |
| Beip.Tilemap | Info/data updates with hex and base64 encodings and map windows | **0.3 app fixture verified subset:** incoming Info/Data loads an HTTP tileset and renders a two-tile red/blue canvas in the browser; decoded tiles and canvas dimensions are asserted and the screenshot was inspected. Isolated tests cover `hex_4`, `hex_8`, `base64_8`, `zbase64_8`, partial updates and safety limits. Original maximum map size is reduced. |
| Media and accessibility | Sounds, speech, avatars, web views and rich display options | **0.3 app fixture verified subset:** inline images and a GMCP line avatar load and display in the browser. Speech, web views, richer display options and actual audio playback remain open. |

The 0.3 browser fixture in `tests/session_test.py` runs two independent local
telnet servers and a local image server against the packaged WebView app. It
checks visual GMCP state, mapper controls, log files, rule actions, scripts,
saved-login boundaries, and persisted settings on a second launch. Its image
uses synthetic red/blue tiles, and its saved password is a synthetic test
value held only in the native test-mode memory vault. The fixture verifies
browser display and command routing, not complete original feature parity.

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
`notify`, and `filterText`. A hit may return `command`, `highlight`, `spawn`,
and `notification` actions plus captures and display/log gag flags. The caller
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
[0.4 recovery notes](README.md).

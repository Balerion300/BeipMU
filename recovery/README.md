# BeipMU recovery preview 0.16

Preview 0.16 completes the previously unpublished integration. Primary and additional
input panes now share history navigation and keep multiline submissions, blank lines
and prefixes together in saved history. Both use configured send/history/push keys;
Ctrl+Down pushes to history, while Move Selection Down can be assigned separately.
Type 0 original input layouts import with copied or global input settings. Imported
floating inputs are reviewed and docked; floating input editing remains open.

ANSI output adds faint, reverse, literal OSC send/prompt links and system-bell routing.
Faint is applied before reverse and equal-color protection. Exact rounding against
the missing original Color.Darken helper remains unverified. Native test mode silently
acknowledges bells; audible quality and custom beep files are not validated.
`/roll` has 34 original-executable comparisons plus packaged owner-routing checks.
Normal `/exit` waits for a request-specific successful settings-save receipt before
native close; failures or cancelled owners leave the window open. `/quit` stays unknown,
matching the inspected original executable.

Validation on October 13, 2026: native build and 56 JavaScript test files pass;
103 shipped classic scripts parse together. Fresh and persisted packaged sessions
(`sessions-20261013-080408`), Pueblo/MXP spacing/link/image fixtures, and normal native
exit/restart acceptance (`exit-20261013-080532`) pass. Real primary/additional form
submissions survive native save/replay as exactly one grouped history record each.
Input and ANSI screenshots were inspected. Source/package/archive bytes and inventory
are checked with `tests/package_test.py`. CI is tracked separately in GitHub Checks.

Full upstream compatibility remains incomplete. History records retain the existing
60 KiB serialized UTF-8 limit. Floating input/edit windows, full history search,
blink/custom beep, scripting COM/filesystem/language support, CHARSET/MCP/MCMP and other
ledger gaps remain. No fresh TLS, native titlebar-drop, subjective audio, decoder-pause
or stress-test claim is made. Original `src/` is intact; recovery is independent
Win32/WebView2 work. [PR #2](https://github.com/Balerion300/BeipMU/pull/2) stays unmerged.
See [COMPLETION-CHECKLIST.md](COMPLETION-CHECKLIST.md) for current gaps and historical evidence.

## Previous preview 0.15

Preview 0.15 adds docked additional input panes through `/newinput`, with independent
drafts, prefixes, sticky selection, shared owner history and saved pane definitions.
They participate in nested layouts and layout copying. Scripts keep `window.Input`
bound to the primary input and can find additional panes with exact-title `GetInput`.
Closing or replacing a pane invalidates its old script handle. Extra input panes
cannot float yet; primary and extra history navigation still differ, and multiline
history is split into individual records for saved restoration.

World profiles now select UTF-8, Windows-1252 or CP437 for incoming text, outgoing
commands and native saved-login text. Existing recovery profiles without an encoding
retain UTF-8; newly created worlds default to Windows-1252, matching the original.
Changes apply on reconnect. Automatic CHARSET negotiation is not implemented, and
unknown imported encodings require a choice before connecting.

Validation: Windows/native build and all 48 module test files pass. Fresh and
persisted packaged sessions pass (`sessions-20261012-100046`), including actual
CP1252/CP437 wire bytes, UTF-8 reconnect, input-pane ownership and script handles.
Pueblo/MXP spacing, links and images pass. Input and encoding screenshots were
inspected; a squeezed encoding selector was fixed and its visible geometry tested.
A separate TLS test attempt timed out around certificate setup, so this release
makes no new full-app TLS validation claim. Its temporary test CA was removed.
The branch CI passed; the PR CI and its retry failed on the Node rules-worker
startup deadline. Local packaged acceptance above passed; full CI is not green.

## Previous preview 0.14

Preview 0.14 adds the original global ANSI palette and policy controls: sixteen
colors, XTerm/CMD/VGA/Old/Bright presets, font bold versus bright colors, equal-color
protection, parsing toggle and received-line reset. Changes affect future text in
all sessions. Existing recovery profiles adopt the original defaults when no ANSI
setting is saved, so the previous hard-coded colors and bold behavior change.
Pueblo BR tags do not reset ANSI by themselves; received LF boundaries do.

Additional commands include bounded /repeat, original-style global /gag, owned
one-shot /grab replies, persisted character /tabcolor and per-session /resetscript.
Repeat shares command budgets and is capped at 64 iterations. Script reset keeps
other sessions isolated; this differs from the original shared script engine.
Silent feedback follows individual command rules; errors and requested data are
not universally hidden. /roll and native /exit remain unimplemented.

Validation: native build, all 43 module test files, fresh and persisted packaged
sessions, and compiled Pueblo/MXP fixtures pass. ANSI settings and rendered output
screenshots were inspected. Full original parity remains incomplete; see the
completion checklist.

## Previous preview 0.13

Preview 0.13 runs triggers in original action order, suspending at sends and script
callbacks before matching later rules. Alias expansion, intercepted commands and
script variable/text edits therefore affect subsequent decisions. Filters and
validated script edits update text ranges without replacing unaffected Pueblo/MXP
links or image nodes. Caption/loading text is excluded from prose offsets.
Queued work is cancelled if its session, connection or rule worker changes.
Restored historical avatar instructions no longer attach to new live lines.

This remains bounded recovery behavior: synchronous script-to-host reads, reentrant
receive ordering, all trigger actions, Unicode index equivalence and native
COM/filesystem compatibility remain open. Rule-tree changes cancel pending work;
completed effects are not rolled back. Transcript snapshot replay remains separate
and does not rerun automation.

## Previous preview 0.12

Preview 0.12 fixes doubled Pueblo line spacing in ordinary HTML output. The
public Blood of Dragons login stream uses `<br>` followed by a transport newline;
only the explicit tag now creates a displayed break outside PRE. Literal spaces
and tabs keep MUSH columns aligned. PRE, plain-text regions and MXP retain their
line semantics, including intentional blank lines. Fragmented parser and packaged
login/WHO/link/image fixtures verify the correction.

Command processing now has awaited per-session queues and cancels stale alias
results after a reconnect. Original alias Active, Echo and Process Commands
controls and unrecognized-command behavior are available. Escaped commands,
nested script Run, send hooks, broadcast and idle events use the owner's command
path. Existing recovery profiles retain an explicitly labeled compatibility
setting until changed. Preview 0.13 integrates resumable trigger ordering.

Per-character restoration saves bounded structured output, history and GMCP state.
Replaying saved output does not rerun triggers, scripts, sounds or sends; saved
images require an explicit click to load. Global/character controls pause capture
without deleting saved output; Clear is separate. Buffers are 64–4096 KiB, at most
10,000 records, flushed atomically every 500 ms and at orderly shutdown. A forced
exit can lose the newest unflushed records. Reviewed original Restore.dat import
uses matching Config slot/size metadata and never changes the original file.
Recovery snapshots and safe raw import do not reproduce original visual-trigger
or spawn re-evaluation during replay.

Image windows now share history, fit/100%/zoom/pan, visible animation pause and
owned Save/Copy actions across docked and floating views. Inline height, avatar
width/minimum height and initial animation settings are configurable. Save keeps
original image bytes; Copy uses the first decoded frame. Native actions support
direct HTTP/HTTPS PNG/JPEG/GIF/BMP/TIFF/ICO up to 16 MiB and 16 megapixels, without
browser authentication. Redirects and other formats are not supported by these
native actions. Visible pause uses a canvas snapshot; the hidden decoder may
continue advancing. URL-based viewing retains the browser's image support.

## Previous preview 0.11

Preview 0.11 adds layered Atlas maps, richer trigger processing, original-style
logging, Auto Emoji, and another set of everyday client commands.

Atlas import/export preserves all records in the three original bundled samples,
including cross-map exits, rectangles, colors, fonts and dangling visual exits.
Docked, floating and editor views share zoom/pan and layer selection. Position and
tracking belong to each live session; viewing a map never sends a game command.
Image/label objects and the full original map-editing toolbar remain open.

Triggers support next-line child activation with line/time limits, capture-only
children, captured-group styles, independent whole-line color/style options,
explicit style on/off and commands activated by clicking. Existing Pueblo/MXP
links retain precedence. Filters that change text still limit later appearance
and link ranges; several original actions and exact send ordering remain open.

Logging supports reviewed filename/date/environment substitutions, a local file
chooser, append, timestamps, typed/sent prefixes, wrapping, indentation, double
spacing, styled escaped HTML, and beginning/visible-window starting points.
Received logs retain text before Auto Emoji and display hooks, as in the original.
Character auto-start is supported. Multiple simultaneous files, midnight automatic
rotation and Restore.dat replay remain open.

Auto Emoji uses the original 4.335 table (1,189 phrases), section grammar and
editable Emoji.txt workflow: copy, edit in Notepad, import, save/reload and revert.
It starts disabled. Typed echoes, images and interactive link boundaries remain
intact. The published repository lacks its original matching implementation, so
Unicode boundaries are an independent implementation of the documented behavior.

Added commands include `/newtab`, `/world`, `/removelast`, `/receivegmcp`, GMCP
dump controls, `/silence`, `/wall`, `/idle`, `/logtop`, `/stoplogs` and `/autolog`.
Broadcast aliases and idle timers retain session ownership. Idle timers are
bounded to 1–1440 minutes; an empty idle command uses Telnet NOP. Imported idle
commands start disabled and recognized embedded credentials are omitted.

Preview 0.10's independent window appearance, reviewed connect templates, nested
splits, scoped settings, search and expanded script APIs remain included. See
[SCRIPT-PARITY](SCRIPT-PARITY.md) for exact scripting coverage and
[COMPLETION-CHECKLIST](COMPLETION-CHECKLIST.md) for the current original-feature
audit. This remains an independent recovery client with substantial original
feature gaps; a working preview does not establish full original parity.

Native/module and packaged evidence is recorded in the completion checklist.
Pueblo/MXP links, inline images and consecutive WHO rows remain regression gates.
The sound-editor and layered-map screenshots were inspected. Native floating
history opens correctly; titlebar drop acceptance remains unverified because the
UI automation tool rejected a drop onto the embedded WebView2 renderer.
Stress tests remain deferred. No fresh full TLS or subjective audio claim is made.

This fork provides an independently implemented Windows x64 client while keeping
the published original `src/` intact. The original shared LibWin32, text renderer,
several implementations, generated properties and Visual Studio project are
absent. This runtime builds without those components or a downloaded upstream
executable. Its code is distributed under the repository MIT license.

Version 0.9 brings original automation behavior into the recovery client.
Aliases and triggers can run before or after inner scopes; original Config.txt
imports retain bounded nested trees, activation and this ordering. Triggers
support Away/Present, once while away, and repeated matches with a distinct
Once per line control. Character variables use `/set name=value`, `/unset name`
and `/printenv`; opt-in variable expansion works in aliases, send and filter
actions. Character variables persist; quick-connect variables last for the session.

The original-style Sound tab plays a chosen local WAV file and speaks whole lines
or captured text through the default Windows voice. Browse, Play and Stop work
without connecting. Enable sound and speech in Settings first. Playback stops on
disable, disconnect and close; results from a previous connection cannot restart it.
Speech uses plain text, one WAV channel, up to eight owner voices with eight queued
utterances each, and at most 2,048 speech characters. Original SAPI XML, voice
selection, OS environment expansion, remote sound files and other audio formats
remain unsupported. The Config.txt review reports unsupported temporal child
subtrees instead of flattening their conditions.

Version 0.8 adds caption dragging into four dock edges and group grips that move
all docked panes on an edge. The edge chooser and keyboard controls remain available.
Aliases and triggers now support bounded nested folders and children, inherited
scope/enablement, subtree copy/delete, and sibling ordering. Children run before a
parent stops further processing; trigger children receive the processed whole line.
Settings provides Global/World/Character selectors and separate output/input
inheritance controls. Supported original character settings import with Config.txt.
World inheritance, retained dormant overrides, sparse field fallback, and grouping
input height with input preferences are recovery adaptations.

Version 0.7 adds resizable docks on all four edges. Input History defaults to
bottom and Image Window to top; pane captions let you choose another edge or
float the pane. Windows → Copy/Paste all window settings transfers the supported
pane arrangement between saved worlds or characters without copying their content.
Tools → Export Atlas Map reviews and saves a single-map `.atlas` archive.
Supported imported room geometry/colors and exit bends survive the round trip;
multiple map layers, cross-layer links and artwork remain unsupported.
Scripts gain `window.Input.Get/Set/SetSel/Length`, read-only world character
collections, window titles, `app.OutputDebugText`, and original-style
`window.SetOnCommand` callbacks. Tools → Script Debug Output opens their messages.

Version 0.4 follows the original 4.335 client inspected directly on Windows:
a bottom-left native popup menu, black output and command input, and connection
tabs and activity counters on one compact bottom row. Worlds, Triggers, Aliases,
Keyboard Macros, Settings and Logging use compact light dialogs with trees or
category lists and inline editors. The supported controls retain their existing
behavior; unsupported original controls are omitted. See the
[direct UI comparison notes](UI-REFERENCE.md). Full original docking and every
original feature are still incomplete. Enter sends input; Shift+Enter inserts a newline.

Version 0.5 adds a resizable right dock for maps, input history, images, notes,
split output and grouped spawn capture. Notes and selected panel layouts persist
for saved profiles. Triggers can capture output until a regex, copy or move it
to spawn panes, filter text and use additional appearance controls. Ctrl+Up
recalls history; Ctrl+Down saves an unfinished command to history without sending.
Smart Paste accepts pasted text or a text file, adds per-line prefixes/suffixes,
paces sends and can be stopped. Logging can include the retained scrollback.

Use `/delay 2s "WHO"` for a delayed command, `/delay every 30s "status"` for a
repeating command, and `/delay list`, `/delay kill ID` or `/delay killall` to
inspect or stop timers in the current session. Timers stop when their owning
session disconnects or closes. Other added commands include `/setinput`,
`/recall`, `/chars`, `/connectioninfo`, `/reconnect`, `/new`, `/close`,
`/ansireset`, `/echo on|off`, `/naws width height`, `/switchtab`, `/smartpaste`,
and `/logall` (the latter uses the recovery Logs folder). Named worlds and
characters with spaces work as `/connect "world name" "character name"`.

Version 0.3 added concurrent sessions, saved world/character profiles, startup
choices, TLS, scoped aliases and triggers, keyboard macros, named output panes,
logging, transcript export, search, preferences and opt-in JavaScript. GMCP
supports stats, IDs/avatars, tilemaps and an opt-in Client.Media subset. A local
map editor stores rooms/exits per world and can send a route after a click.
Character login can keep passwords in Windows Credential Manager separately
from settings. See [the feature inventory](FEATURE-PARITY.md) for exact coverage
and remaining work: this preview does not yet match every original feature.

Pueblo and the documented MXP subset retain clickable website/command links,
inline images and ANSI styling. Images preserve aspect ratio and enclosing
command links, including URLs with query strings or no filename extension.
Failed images show a source link. Paired Pueblo BR/wire line endings inside PRE
do not add blank lines; intentional blank lines, tabs and spaces are preserved.

## Build and run

Install Visual Studio 2022 Build Tools with Desktop development with C++, Node.js
for tests, and Microsoft Edge WebView2 Evergreen Runtime. Run:

```powershell
./recovery/build.ps1
```

The script downloads pinned WebView2 SDK 1.0.4258.31, builds the native application
and telnet tests, runs the JavaScript tests and creates
`recovery/dist/BeipMU-Recovery-0.14-x64.zip`. Extract the whole archive and run
`BeipMU-Recovery.exe`; keep its `ui` directory beside the executable.

Blood of Dragons defaults to `bod.westeros.org`, port `3000`. Save a world in
Profiles to use character profiles and the map editor. Enable TLS with the
server's TLS port. Certificates and hostnames must validate against Windows
trust; there is no automatic fallback to an unencrypted connection.

Pueblo activates when its announcement and markup arrive. Inline images are
initially enabled; no separate image-viewer toggle is necessary. Click a command
link for its first action; right-click or Shift-click for multiple actions.
Sound, startup scripts and automatic login require explicit choices. Saved
password login over plain TCP requires its separate character setting.
The login template currently sends `connect name password`.

Settings live in `%LOCALAPPDATA%/BeipMU-Recovery/settings.json`, session logs in
the adjacent `Logs` directory and browser state in `WebView`. Original BeipMU
settings can be reviewed and imported through Tools; the original files are not changed. Profile settings exclude passwords,
transcripts and command history. Passwords explicitly remembered in the character
editor use Windows Credential Manager. Export saves retained visible scrollback;
session logs record completed lines while logging is enabled.

Scripts run in bounded workers with a limited compatibility API: output write,
connection send/display, line callbacks and GMCP callbacks. Script workers cannot
fetch network resources or launch child workers; commands go through their owning
session. Regex rules also run in bounded workers. Server markup is parsed into
text, links and images, never executed as HTML or JavaScript. Links open only
after user interaction.

## Verification

The build runs the parser and feature-module checks, shortcut model suite,
and native telnet tests, and compiles the native WAV/SAPI acceptance test.
With Python installed, run these compiled-app fixtures:

```powershell
python recovery/tests/preview_test.py
python recovery/tests/session_test.py
python recovery/tests/tls_loopback_test.py
python recovery/tests/tls_preview_test.py
```

For 0.5, the packaged Pueblo/MXP fixtures, two-launch session/panel/settings
fixture and three native TLS cases passed. The session fixture checks grouped
capture and cancellation, image/history/map/notes/split panes, logging from
scrollback, timer ownership and cancellation, and paced Smart Paste routing.
The full-app TLS fixture was last verified in 0.3; its 0.4 rerun stopped at the
Windows certificate-install prompt. No complete later full-app TLS run is claimed.

Pueblo/MXP fixtures check three loaded images, a failed-image fallback, command
clicks and consecutive WHO rows. Session fixtures check separate connections,
rules, macros, logs, settings persistence, scripts and worker restrictions.
TLS fixtures check trusted/untrusted/wrong-host certificates and the actual app.
TLS tests create a temporary local test certificate and remove it afterward.
Fixtures use local servers and isolated settings without live game credentials.
Results, wire evidence and screenshots are in `recovery/test-results`.

## Supported markup subset

Pueblo: `xch_mudtext`, `a href`, `a xch_cmd` / `xch_hint`, `img src`, basic text
styles and entities. MXP: telnet option 91, open/secure/locked and permanent
modes, `SEND href/hint/prompt`, `A href`, `IMAGE url/fname`, `IMG src`, `B`, `I`,
`U`, `COLOR`, `FONT color`, `BR`, `P`, `VERSION` and `SUPPORT`. Custom elements,
MXP SOUND, frames, element definitions, image maps and full conformance remain
open. Other outstanding work includes nested/multiline triggers, full script
objects, arbitrary split docking, SAPI XML, Atlas layers/drawings and unsupported
original preferences.

The user verified live Blood of Dragons login and images in preview 0.1.
This reconstruction was informed by published source and analysis of official
4.335 x64 (SHA256 `446b1a03de52b059df451c0a0591d2b3ed1094146a7f0ce3f775ced1d77f7870`).


Version 0.6 adds independent floating Windows windows for the supported panes.
Use the pane's Float button, then Dock to return it. Each window stays attached
to its originating session; position and size are saved with its pane layout.
This supports float/dock actions, not the original free drag docking system.

The Tools menu includes Import Original Settings or Map and Keyboard Shortcuts.
Config.txt import previews supported worlds, characters, preferences, aliases,
triggers and macros before applying selected categories. Passwords, connect
strings and scripts are omitted. Atlas import accepts original XML and ZIP
Atlas.xml formats, previews room/exit counts and unresolved references, then
replaces only the selected world's map. Layers, drawings and unresolved exits
are reported rather than silently presented as fully imported.

Keyboard Shortcuts supports changing or clearing supported built-in actions,
with conflict resolution and Apply/OK/Cancel. Macro overrides remain explicit.
Scripts add original-style SetOnSend/SetOnReceive boolean suppression, raw
SetOnGMCP callbacks, connection Display/Transmit, window.UserData, named trigger
functions and bounded CreateTimeout/CreateInterval/Kill. Script Debug Output
collects errors. These are opt-in isolated JavaScript features; arbitrary COM,
filesystem access, original native application automation and every script
object are not implemented.

For 0.6, all build/module checks and the packaged Pueblo/MXP image/link/WHO
fixtures passed. The two-launch session fixture passed in
`test-results/sessions-20261011-232953`, including real native floating child
ready/rendered/capture acknowledgments and screenshots, owner routing, docking,
layout restoration and close cleanup; shortcut remapping/persistence;
Config.txt review/apply and credential/script omission; real WebView ZIP Atlas
decompression/apply; and worker callbacks, trigger ranges, timers and debug
output. The 0.6 native TLS attempt passed untrusted-certificate rejection but
its trusted case timed out; the last complete native TLS verification remains
0.5. No TLS implementation was changed in this preview.

For 0.7, the Windows build, native telnet checks and all module tests passed.
The packaged Pueblo/MXP fixtures rendered three images, reported a missing image,
sent clicked commands and preserved consecutive WHO rows. The two-launch session
fixture (`sessions-20261011-234930`) passed on fresh and persisted launches,
including all four dock edges, copied layouts and content isolation, native
floating-pane cleanup, reviewed Atlas save with byte-for-byte ZIP verification
and reimport, original script Input controls, command callbacks and a timer that
reads an updated inactive-session draft. Source UI files matched the packaged files.
TLS implementation is unchanged; no complete fresh TLS run is claimed for 0.7.

For 0.8, the Windows build and complete native/module suite passed. Packaged
fresh and persisted session tests (`sessions-20261012-063705`) verified nested
alias/trigger editors, isolated regex children, scope inheritance and settings
save/reopen/cancel, alongside existing native floating, script and Atlas checks.
Focused browser pointer checks verified caption/group drag, cancellation and
preserved floating identity. Packaged Pueblo/MXP image/link and WHO-spacing tests
passed. TLS code is unchanged; no new full TLS run is claimed for 0.8.

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

Preview 0.13 acceptance: fresh and persisted sessions passed at
`sessions-20261012-092530`, including live interactive-node preservation, native
wire ownership, callback cancellation and avatar replay isolation. Native/module
checks and compiled Pueblo/MXP fixtures passed. The continuation screenshot was
inspected. These checks establish the listed subset, not complete original parity.

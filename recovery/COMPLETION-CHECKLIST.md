# Original BeipMU completion checklist

Current audit: October 12, 2026. Target: original 4.335, compared against its
isolated executable, `src/`, and every topic in `Documentation/`. This is the
current checklist; historical milestone sections in FEATURE-PARITY are evidence
for individual slices, not current lists of missing features. No percentage is
assigned. A row closes only with source/reference comparison and real behavior.

Status: **partial** means useful behavior exists but original parity remains;
**open** means not implemented; **in progress** is not a verified release claim.
The independent recovery implementation and missing upstream dependencies remain
as described in README. The original source stays intact.

| Area and original evidence | Current coverage | Completion work |
| --- | --- | --- |
| Shell/Windows menu (`Wnd_Main`, direct menu) | Partial: tabs, named panes, four edges, nested splits/tabs, native floating, layout/appearance copy | Native drag between windows; multiple input/edit windows; multiple main windows; hidden captions; original saved arrangements |
| Worlds (`Dlg_Connect`, `Root.prp`) | Partial: worlds/characters, startup, TLS, credential vault, notes, reviewed connect templates | Complete import/export and per-character flags; puppets and transfer behavior; world samples |
| General settings (`Dlg_Settings`, direct dialog) | Partial: inline images, sound enable | Voice/markup; inline height, avatar geometry, animated image pause; activate-on-disconnect; close alerts; Ctrl-to-change-layout |
| UI Theme settings | Partial: dark/light | Original theme elements, presets and all customizable colors |
| Input Windows/settings (`Dlg_InputWindow`, `Wnd_Input`) | Partial: independent font/styles/colors, sticky input and autosize | All cursor/history/selection rules; extra panes/prefixes; spell checking; tab completion; command prefix/unrecognized-command settings |
| Output Windows/settings (`Dlg_TextWindow`, `Wnd_Text`) | Partial: font/styles/colors/margins, paragraph spacing, wrapped indent, fanfold and fixed width | Exact selection/scrolling options; timestamps/line metadata; complete split behavior and preservation across every pane |
| Logging/settings (`Logging`, `OM_Logging`) | Partial: reviewed filenames/date/environment tokens, local chooser, formatted text/HTML, typed/sent prefixes, start positions and character auto-start | Multiple concurrent files, midnight automatic rotation, complete original timestamp-flag import and per-character lifecycle |
| Network/settings (`Telnet`, `Connection`, `CodePages`) | Partial: telnet, Schannel TLS, NAWS, GMCP | Original encoding choices, reconnection/keepalive, terminal types, debug output, MCP/MCMP and all negotiated options |
| Taskbar/settings (`Wnd_Taskbar`, `Dlg_Settings`) | Partial: activity, connection and unread indicators | Original tab colors, grouping, notification and taskbar options |
| Keyboard Shortcuts (`Shortcuts.md`, `Dlg_Settings`) | Partial: remappable supported actions | New main window/input pane; context-sensitive history and output navigation; all original actions |
| Auto Emoji (`Emoji.md`, assets and settings) | Implemented documented workflow: original default table, sections, append/replace, Unicode matching, copy/edit/import/save/reload/revert and enable | Original matching implementation is absent; exact undocumented boundary behavior remains an independent reconstruction |
| Scripting (`ScriptingAPI.md`, `OM.idl`, `*_OM`) | Partial: expanded API subset and member inventory | See SCRIPT-PARITY for exact object/member list; controlled native filesystem/COM, existing-script compatibility and script languages |
| Restore Logs/settings (`Logging`, `Dlg_Settings`) | Open | Per-character restore buffers, startup recovery and controls |
| ANSI Colors/settings (`AnsiParser`, `TextToLine`) | Partial: ANSI styles | Custom 16-color palette, bold policy, invisible-color policy, beep, flash, parse toggle and reset-on-newline |
| AI/settings (`Dlg_Settings`, `Wnd_Input`) | Open | Original local-model integration, model configuration and input actions; no credentials or live service use in tests |
| User Data/settings (`Dlg_Settings`) | Open | Original paths, backup/import/export/move behavior and dialogs |
| Aliases (`Aliases.md`, `Connection`) | Partial: scoped nested tree, variables, pre/post order | Full internal-command ordering, echo/processing flags, debugger and exact compatibility limits |
| Triggers (`Triggers.md`, `Connection`, `Dlg_Triggers`) | Partial: scoped/nested/repeated matches, multiline child windows, capture-only children, captured-group appearance, click-only commands, send/spawn/sound/script | Text-changing filter ordering, font/hash/flash/paragraph actions, multiline sends, untitled capture, full conditions/actions and debugger |
| Find/history/editing (`Dlg_Find`, `Wnd_Input`) | Partial: direction/case/word/regex search and command replacement | Full history search/recall selection and editing semantics; editor windows |
| Smart Paste (`Dlg_SmartPaste`) | Partial: text/file/clipboard preview, saved affixes, zero delay, pacing/cancel | Actual clipboard-read acceptance and exact scheduling/alias behavior |
| Client commands (`CommandLine.md`, `Commands.cpp`) | Partial | Audit every command below; original source also has commands absent from the Markdown index |
| Map/Atlas (`Mapping.md`, assets, original schema) | Partial: layers, rooms/exits/routes, rectangles, cross-map/dangling links, sample-complete import/export, shared canvas and session position/tracking | Image/label objects, complete geometry editing/toolbar, ambiguous location tracking and original renderer parity |
| Spawn windows (`SpawnWindows.md`) | Partial: grouping/capture/move/copy/log gag | Multiple independently positioned streams, formatting in all floating modes, original capture semantics |
| Stats (`Stat Windows.md`, `GMCP`) | Partial: text/range/progress | Full GMCP styles/layout, window ownership/docking and script objects |
| Tilemap (`TileMap.md`) | Partial: real rendered tiles, encodings and partial updates | Original size limits, windows and complete format behavior |
| Images/avatars (`ImagePane`, `ImageBanner`) | Partial: inline/load/fallback/linked images, separate image pane | Original zoom/pan/save/copy/animation controls and geometry |
| Client.Media (`GMCP.md`) | Partial: default/load/play/stop module | Actual audible playback and remaining formats/options |
| Pueblo/MXP (`TextToLine`, parser evidence) | Partial: links/images/styles and WHO spacing protected | Full elements/entities/definitions, secure modes, sound/frames/image maps; conformance evidence |
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

Open original commands/options from documentation/source: `/debugnetwork`, `/debugtriggers`, `/exit`, `/gag`, `/grab`, full `/help`, `/map_addroom`, `/map_addexit`, `/newedit`, `/newinput`,
`/opendialog`, `/ping`, `/puppet`, `/puppets`, `/quit`, `/resetscript`, `/roll`,
`/script`, `/slist`, `/tabcolor`, `/ttype`, `/webview`.
Source-only commands and historical version differences must be reconciled
before this ledger can be called exhaustive.

## Release evidence

The last published starting point is preview 0.10, commit
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

# Direct BeipMU UI reference

Reference inspected on Windows on October 11, 2026: original BeipMU 4.335
(About reports October 7, 2026), executable SHA256
`446b1a03de52b059df451c0a0591d2b3ed1094146a7f0ce3f775ced1d77f7870`.
An isolated copy with the shipped default configuration was used, avoiding
changes to existing player configurations. The original executable is a visual
reference, not a dependency of the recovery build.

| Surface inspected directly | Observed appearance | Recovery adaptation |
| --- | --- | --- |
| Main window | Black output and input; thin divider; one bottom strip with menu/person/globe controls, light-blue selected tab, Typed/Online/Idle at right | Same overall arrangement, with a resizable input pane |
| Main menu | Bottom-left popup: Windows, Tools, Logging, Settings, Help, separator, Close all Windows and Exit | Native popup with these primary entries; working fork tools remain in submenus |
| Worlds | White world/character tree at left, sample tree below; Server editor at right; two rows of buttons below | World/character tree and inline editing of supported saved profile fields |
| Triggers | Tree at left; Description, Matcharoo and matching controls at right; action tabs beneath | Supported matching and action controls in the same tree/editor arrangement |
| Aliases | Tree at left; Description, Matcharoo, matching controls and multiline Alias for at right | Supported scoped aliases edited inline with bottom New/Copy/Delete/Apply/OK/Cancel |
| Keyboard Macros | Tree at left; Description, Macro Text, Type into Input Window, key capture and modifiers at right | Same tree/editor pattern with supported key combinations and input/send mode |
| Settings | Narrow white category list at left; gray settings panel; OK/Cancel bottom right | Supported preferences grouped by category in the same arrangement |
| Output settings | Black text sample; Courier New 10 pt; History Lines 10000; paragraph spacing and margins zero | Courier New at approximately the same screen size; default history 10000; zero paragraph spacing |
| Input settings | Courier New 10 pt on black; resize-to-content options; Local Echo | Black input, resizable height and supported Local Echo setting |
| Logging | White Current list; Stop/Stop All below; New section with Start and starting-point controls | Current logging state with start/stop, export and beginning-of-scrollback; the 0.5 packaged fixture verified the restarted log includes earlier output |
| Output context menu | Find, Pause, Split, Copy screen, Clear, global settings and Settings | Supported output actions retained; 0.5 adds a session-scoped split pane, while the original context menu and flexible split behavior remain incomplete |
| Windows / Map | Window menu offers additional input, edit, history, image, map and character-notes panes; Map docks at the right with its own caption and toolbar | The 0.5 packaged fixture verified a keyboard-resizable right dock with a two-room map, session history, a loaded image, character notes, split output and grouped spawned streams |

The original has additional controls and features that the recovery runtime does
not implement. Visual similarity does not imply full feature parity. Native
dialogs and WebView-rendered recovery dialogs also differ in control rendering.

The original source and documentation describe more than the directly inspected
screens. Its history pane stores sent commands and supports recall/search;
character notes are attached to a profile; output can split for scrollback;
and the image window is a separate dockable pane. See
[`Wnd_Main.cpp`](../src/Wnd_Main.cpp),
[`GettingStarted.md`](../Documentation/GettingStarted.md), and
[`Shortcuts.md`](../Documentation/Shortcuts.md). The 0.5 integration fixture
verified those supported behaviors as session-scoped actions in two launches.
The original saves flexible docking layouts;
the recovery worktree stores open pane types per profile and dock width, but
cannot yet reproduce the original arrangement.


The October 11 follow-up used the same original 4.335 executable directly.
Windows includes New Tab, New Window, New Input Window, New Edit Window,
Toggle Input History/Image/Map/Character Notes, Copy/Paste all window settings,
and Show Hidden Captions. Input History initially opened as a small bottom
pane; dragging its horizontal divider expanded it. Its context menu exposes
Find, Pause, Split, Copy screen to clipboard, Clear, Use global settings and
Settings. Recovery keeps its right dock and explicit Float/Dock controls;
the bottom history arrangement and original caption/drag system are not exact
replicas. Version 0.6 gives the supported panes independent Windows windows.
The shortcut editor follows original documented action labels and uses a
compact light list and key field. The import review is a recovery addition.

The next direct inspection on October 11 reconfirmed the Windows submenu labels
and expanded the original Input History by dragging its divider. History sits
below command input and above the bottom tab strip; growing it reduces the main
output while preserving input height. The 0.7 recovery layout follows that
placement, adds top/left/right groups, and retains its explicit edge chooser and
Float/Dock controls. Copy/Paste all window settings transfers the supported
pane layout internally, following the original internal clipboard workflow;
it does not yet copy every original output/input preference.

October 12 direct inspection of original 4.335 Settings reconfirmed its compact
light category dialog and General image controls. Source inspection paired this
with character/global Output/Input settings in Wnd_Main.cpp and Wnd_Input.cpp.
Recovery 0.8 keeps that category layout and adds an explicit scope selector. Its
world inheritance and retained override drafts are recovery adaptations. Caption
and group dragging now supplement the existing edge chooser; arbitrary original
split layouts and native cross-window dragging remain incomplete.


## 0.9 original automation comparison

Original 4.335 was opened directly on 2026-10-12. Tools > Triggers showed separate
Once per line, Only when Away/Present, Once, cooldown, and child-trigger controls.
The Activity Sound sample uses `(.+)`, Once per line, Away and the Sound tab.
The Sound tab contains Play Sound, Sound File, Browse and Play, then Speak,
Say whole line and Say only this. Its sample path is Windows Media chord.wav.
The original also advertises SAPI XML and the General settings offer a Voice
selector. Recovery mirrors the supported Sound controls and conditions, with
plain-text/default-voice limits stated in the dialog and feature inventory.
`src/Connection.cpp`, `src/FindString.cpp`, `src/PropFuncs.cpp` and `src/Root.prp`
provide the companion evidence for traversal, variables and away-once semantics.

## 0.10 comparison

On October 12 the exact original reference hash above was checked again. Its
live Settings dialog lists General, UI Theme, Input Windows, Output Windows,
Logging, Network, Taskbar, Keyboard Shortcuts, Auto Emoji, Scripting, Restore
Logs, Ansi Colors, AI and User Data. Restore Logs describes refilling windows
from Restore.dat, an Enabled control and a per-character KiB buffer size.
The live Tools submenu includes separate Trigger, Alias and Network debuggers.
These additional categories/actions are retained as open in the current checklist.

The packaged 0.10 Output settings screenshot shows the scoped font face/size,
sample and inheritance controls in the compact category dialog. The sample now
updates when reopened and when controls change. Runtime font/color/margins and
input sticky/autosize were verified in the actual WebView. Original display
options not represented by the recovery controls remain listed explicitly.

## 0.11 comparison

The original settings' Logging and Auto Emoji categories now have recovery
counterparts with filename/formatting controls and an editable original Emoji.txt
workflow. Trigger child-window controls live in a Children tab; this keeps Sound
controls visible at the packaged test viewport. Appearance has tri-state styles
so unchanged and explicitly off remain distinct.

Atlas shows room rectangles, exit polylines and background drawings in a shared
layer canvas, with zoom, fit and owner-specific tracking. Packaged native floating
map readiness/rendering is checked. The actual native titlebar-drop gesture
remains unverified; successful floating-window creation is a narrower claim.

## 0.12 comparison

The original image pane's history, previous/next, clear, source and animation
controls are represented in the shared dock/floating image view. Fit/100%, zoom,
pan and native Save/Copy are recovery additions. Avatar width and minimum height
preserve the image aspect ratio; live GMCP metadata changes update paused images.
Visible pause is a snapshot, not a decoder stop. Original missing renderer code
does not establish every original image control's exact behavior.

Aliases expose original Active/Echo/ProcessCommands controls and an explicit
legacy recovery setting. Restore Logs provides global/character enable, KiB buffer
size rounded to 64 KiB, separate Clear, and reviewed original-file import with
mapped character selection. These are functional counterparts to the original
categories, with the replay and disable semantics documented in README.

The reported Pueblo login screenshot was matched to actual public BR+LF input.
A dedicated packaged rendering checks ordinary row adjacency, deliberate blank
rows, columns, styled command links and PRE WHO output. The corrected screenshot
is part of the packaged session evidence.

## 0.13 text-edit comparison

Trigger filters and script insert/delete/style operations preserve unrelated
Pueblo/MXP anchors and image elements. At an anchor boundary, inserted plain text
stays outside the anchor; insertion strictly inside retains its link identity.
Image captions and avatar decorations do not consume script/trigger prose offsets.

## 0.14 ANSI settings

ANSI Colors has sixteen editable swatches, individual defaults, the five original
palette presets and four global policies. Profile dialogs show the global policy
read-only. Existing transcript appearance remains unchanged when preferences are
edited; future output uses the new palette. Character tab color paints the tab
background, with a selected tint and contrasting text.

0.14 packaged acceptance (`sessions-20261012-094157`) passed in fresh and persisted runs. The ANSI settings and rendered output screenshots were inspected: the custom orange bold line and following unstyled line match the asserted computed styles. This verifies the implemented surface, not every original ANSI action or native window gesture.

## Preview 0.15 input and encoding surfaces

Packaged fresh/persisted run `sessions-20261012-100046` verifies two alpha-owned input panes and a beta pane, nested placement, independent drafts, retained textarea identity/focus, settings Save/reopen/Cancel and script-driven title/prefix/selection. The additional-input screenshot was inspected. Input panes are dock-only in this preview. The world encoding selector uses the original three labels; exact original dialog placement is not claimed because CDlg_Server.h is absent. Screenshot review caught a collapsed selector; the corrected grid row and wrapped note pass full-value width and containment assertions. The corrected screenshot was inspected.

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

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
| Logging | White Current list; Stop/Stop All below; New section with Start and starting-point controls | Current logging state with functional start/stop and export controls |
| Output context menu | Find, Pause, Split, Copy screen, Clear, global settings and Settings | Supported output actions retained; original split/docking behavior remains incomplete |
| Windows / Map | Window menu offers additional input, edit, history, image, map and character-notes panes; Map docks at the right with its own caption and toolbar | Supported map editor remains a dialog; original docked-pane system is not yet reproduced |

The original has additional controls and features that the recovery runtime does
not implement. Visual similarity does not imply full feature parity. Native
dialogs and WebView-rendered recovery dialogs also differ in control rendering.

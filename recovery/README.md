# BeipMU recovery preview 0.4

This fork provides an independently implemented Windows x64 client while keeping
the published original `src/` intact. The original shared LibWin32, text renderer,
several implementations, generated properties and Visual Studio project are
absent. This runtime builds without those components or a downloaded upstream
executable. Its code is distributed under the repository MIT license.

Version 0.4 follows the original 4.335 client inspected directly on Windows:
a bottom-left native popup menu, black output and command input, and connection
tabs and activity counters on one compact bottom row. Worlds, Triggers, Aliases,
Keyboard Macros, Settings and Logging use compact light dialogs with trees or
category lists and inline editors. The supported controls retain their existing
behavior; unsupported original controls are omitted. See the
[direct UI comparison notes](UI-REFERENCE.md). Full original docking and every
original feature are still incomplete. Enter sends input; Shift+Enter inserts a newline,
and Ctrl+Up/Down recalls input history.

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
`recovery/dist/BeipMU-Recovery-0.4-x64.zip`. Extract the whole archive and run
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
settings are not imported or changed. Profile settings exclude passwords,
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

The build runs 387 parser and feature-module checks plus native telnet tests.
With Python installed, run these compiled-app fixtures:

```powershell
python recovery/tests/preview_test.py
python recovery/tests/session_test.py
python recovery/tests/tls_loopback_test.py
python recovery/tests/tls_preview_test.py
```

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
open. Other outstanding work includes original config import, nested/multiline
triggers, full script objects, docking, speech and original atlas compatibility.

The user verified live Blood of Dragons login and images in preview 0.1.
This reconstruction was informed by published source and analysis of official
4.335 x64 (SHA256 `446b1a03de52b059df451c0a0591d2b3ed1094146a7f0ce3f775ced1d77f7870`).

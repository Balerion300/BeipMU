# BeipMU recovery preview 0.2

This is the first buildable replacement runtime in the Balerion300/BeipMU fork.
The original `src/` remains intact. The published client cannot currently be
compiled because its shared LibWin32, Text renderer, several implementations,
generated properties, and Visual Studio project are absent.

This preview is **not feature-equivalent to upstream BeipMU**. It provides a
Windows x64 application with plain TCP connections, automatic Pueblo handshake,
an explicit subset of MXP, clickable website and server-command links, inline
images, ANSI colors, and command history. Image tags are treated as images even
when their URLs have query strings or lack a filename extension.

Images load in the output, keep any enclosing command link, preserve their
aspect ratio, and show a source link when loading fails. The display uses the
Microsoft Edge WebView2 Runtime. Only locally shipped UI JavaScript executes;
server markup is parsed into text, links, and image records, never inserted as
HTML. Server-directed navigation and browser permissions are disabled.

## Build and run

Install Visual Studio 2022 Build Tools with Desktop development with C++, Node.js
(for tests), and the Microsoft Edge WebView2 Evergreen Runtime. Run:

```powershell
./recovery/build.ps1
```

The script downloads the pinned WebView2 SDK 1.0.4258.31 from NuGet, builds the
application and native tests, runs the parser tests, and creates
`recovery/dist/BeipMU-Recovery-0.2-x64.zip`. Extract the entire archive and open
`BeipMU-Recovery.exe`. Keep the `ui` directory beside the executable.

For Blood of Dragons the initial fields are `bod.westeros.org`, port `3000`.
Click Connect. Pueblo activates when its announcement and markup arrive; no
image-viewer toggle is necessary. Click a command link to send its first action;
right-click or Shift-click a multiple-action link to choose an action.

The preview does not read, change, or save the original client's settings. It
does not save passwords or transcripts. Its WebView profile is stored under
`%LOCALAPPDATA%/BeipMU-Recovery/WebView`.

## Verification

The build runs 318 parser checks and native telnet tests. With Python installed,
`python recovery/tests/preview_test.py` runs the compiled application against
local Pueblo and MXP servers. Each test verifies three successfully rendered
images, a visible failed-image fallback, and a clicked command received by the
server. The Pueblo test also verifies consecutive WHO rows without extra blank
lines, preserving column spaces. It saves the rendered application view and wire evidence under
`recovery/test-results/`. These tests use no live game credentials.

## Supported protocol subset

Pueblo: `xch_mudtext`, `a href`, `a xch_cmd` / `xch_hint`, `img src`, basic text
styles and entities. MXP: telnet option 91, open/secure/locked and permanent
modes, `SEND href/hint/prompt`, `A href`, `IMAGE url/fname`, `IMG src`, `B`, `I`,
`U`, `COLOR`, `FONT color`, `BR`, `P`, `VERSION`, and `SUPPORT`.
Unsupported custom elements are not advertised. MXP SOUND, frames, element
definitions/macros, image maps, and full protocol conformance are pending.

## Remaining recovery work

* Recover or recreate the shared framework sufficiently to compile original
  `src/`, rather than only this replacement runtime.
* Bring back the original world profiles, triggers, aliases, logging, settings,
  scripting, accessibility, GMCP packages, and other application features.
* Add verified TLS connections; this preview supports plain TCP only.
* Complete the MXP implementation and test against real-world servers.
The user verified login and inline images on Blood of Dragons in preview 0.1.
Preview 0.2 additionally fixes paired BR/wire line endings inside Pueblo PRE,
following the Valyria and Atlantis spacing correction. Intentional blank lines
and spaces remain intact.

The reconstruction was informed by the published source and analysis of the
official 4.335 x64 executable (SHA256
`446b1a03de52b059df451c0a0591d2b3ed1094146a7f0ce3f775ced1d77f7870`).
No decompiler output or downloaded executable is required to build this runtime.
The independent replacement code is distributed under the repository MIT license.

# Scripting parity ledger

Audited 2026-10-12 against the checked-in original `Documentation/Scripting.md`,
`ScriptingAPI.md`, `ScriptingExamples.md`, `WebViews.md`, `src/OM.idl`,
`src/OM_Props.idl`, and original object implementations. This is a living gap
inventory, not a declaration of complete original compatibility.

Closeout at published preview 0.15: no further script integration is authorized
in this round. Resume priorities and the local-only draft checkpoint are recorded
in [COMPLETION-CHECKLIST.md](COMPLETION-CHECKLIST.md). The original `/roll`
comparison is draft evidence; it is not a feature of 0.15.

Preview 0.12 routes Run and hooked sends through an awaited, owner/epoch-bound
dispatcher, carrying hook provenance so Send is not hooked twice and Transmit
continues to bypass OnSend. Nested Run effects finish before their parent resumes;
old alias worker results cannot send after reconnection. Full original native
COM/filesystem compatibility remains open; preview 0.13 integrates resumable
trigger rule evaluation and validated incremental line edits.

## Evidence and discrepancies

The complete original automation surface contains 33 IDL interfaces. The inventory
at the end lists every published IDL member, including interfaces absent from the
older Markdown reference. Implementation evidence includes `App_OM.cpp/.h`,
`Connection_OM.cpp/.h`, `Wnd_Main_OM.cpp/.h`, `Wnd_Text_OM.cpp/.h`,
`OM_Window_Input.cpp/.h`, `OM_Window_Properties.cpp/.h`, `OM_Logging.cpp/.h`,
`OM_Sockets.cpp/.h`, `Wnd_FixedText_OM.cpp/.h`, `Window_Events_OM.cpp/.h`,
`OM_Help.cpp/.h`, and `Scripter.cpp/.h`. The original graphics factory is declared
but its object implementation is not present in these published files.

Where documentation and implementation disagree, this ledger records the
disagreement instead of silently advertising both contracts:

- `window.Run` says “execute script” in old Markdown; `Wnd_Main_OM.cpp` invokes
  `SendLines`, with command/alias processing. Recovery now emits client commands.
  Use `/@` within Run to execute script as a client command.
- `Window_Main.SetOnActivate` Markdown lists userdata first; COM invocation in
  source reverses the dispatch argument array, delivering `(activated, userdata)`.
- `Window_Text.SetOnPause` source sends `(window, paused)`; old Markdown lists
  only the boolean. Worker dispatch uses the source signature.
- Socket Markdown lists `Disconnect`, `Receive` and `ReceiveBytes`; current IDL
  lists `Close`, `SetFlag`, and `OnReceive(socket, data)` with bytes/text in the
  callback. `Socket::SetFlag` itself currently returns success without action.
- `Trigger.Aliases` appears in Markdown but not current IDL; source exposes nested
  `Triggers`. Current IDL adds `Trigger.Delete` and collection `Active/Delete`.
- The Docking example calls `window.MakeDocking(hwnd)`; that method is not exposed
  in the checked-in `Window_Main` IDL. `Docking.Dock` still has its own interface.
- `Window_Graphics.Width/Height` are properties in current IDL, not methods as one
  old Markdown example suggests. `Window_Input` replaces the old documented name
  `Window_Control_Edit` and adds Prefix/Title.
- Source `TextWindowLine` has UTF-8-oriented underlying storage whereas JavaScript
  strings use UTF-16. Non-ASCII range parity requires original executable fixtures.
  `Wnd_Text_OM.h`'s two-argument constructor always calls CreateFromHTML despite
  receiving an `fHTML` argument; recovery follows documented plain Create behavior.

## Implemented and bounded

| Object | Implemented surface | Material limits |
| --- | --- | --- |
| App | Worlds/Windows, BuildNumber/Version, optional BuildDate, timers, debug text, IsAddress, PlaySound/StopSounds | Build identity identifies recovery, not original. BuildDate is undefined unless supplied. DebugHTML extracts safe text; no rich debug HTML. Sound requires enabled local WAV playback, volume 1; StopSounds affects the owner. |
| Worlds/Characters | Callable default accessor, Item, Count, name lookup | Bounded context snapshot, invalid lookup currently returns null rather than original HRESULT exception. |
| World | Name/Shortcut/Info/Host, Characters | Name/Shortcut/Info/Host writes allowed only for the worker's current world. Host is recovery host field, with port stored separately. Foreign profile writes fail explicitly. |
| Character | Name/Shortcut/Info, optional LastUsed/TimeCreated/LogFileName reads | Owner Name/Shortcut/Info writes; original sensitive Connect, custom LogFileName writes, Puppets/Triggers/Aliases remain gaps. Dates absent from profile storage remain undefined. |
| Windows | Callable collection, Count, current window identity, foreign title summaries | Full foreign Window_Main objects and cross-session mutation require capabilities. |
| Window_Main | Output/Input/Connection, UserData, Title/TitlePrefix, Run, variables, command/activate hooks, Close, activity, connect dialog | Native file execution, History and spawn callbacks remain gaps. Exact-title additional GetInput lookup is implemented in 0.15. Close callback registration exists; host must dispatch it before teardown. TitlePrefix requires host tab integration. |
| Connection | Send/Transmit, Receive/Display, hooks, connection/log status, World/Character/Window_Main, null Puppet, Log, Reconnect eligibility | Receive injects decoded parser text, not original raw telnet bytes. Receive from its own receive callback fails. Reconnect returns eligibility, actual connection completes asynchronously. Display requires host pipeline integration to run triggers without repeating Receive. |
| Window_Input | Get/Set, SetSel, GetSelStart/GetSelEnd, Length, Prefix/Title and exact-title additional GetInput | Negative EM_SETSEL semantics remain different; primary Prefix/Title are runtime-only and full native settings sharing remains open. |
| Window_Text | Write/WriteHTML, Create/CreateHTML/Add, Paused, pause hook registration, Properties.Title read | CreateHTML supports basic safe emphasis/font/entity text only; does not create images, links, complete original HTML or native window properties. Host must dispatch pause changes. |
| TextWindowLine | String/Length/HTMLString, Insert/Delete, Color/BgColor, Bold/Italic/Underline/Strikeout | Windows COLORREF interpreted as BGR integer, end-exclusive ranges. 8192 UTF-16 units, 512 style runs. Flash/FlashMode/Blink explicitly fail. Incoming trigger/display edits preserve unaffected links/images through validated insert/delete/style operations. Trigger matching is bounded to 4096 UTF-16 units. |
| Timer | CreateTimeout/CreateInterval, UserData, Kill, Active | 16 timers per owner, 100–3600000 ms, stop on true; cleared on disconnect/close/runtime stop. |
| ArrayUInt | Callable Item/Count trigger capture ranges | 32 integer entries; invalid indexes currently return zero. |
| Log | Write/WriteLine/FileName, null when not logging | Writes only to existing owner log; WriteLine serializes plain text, no original rich log modes. |

Original spelling and all-lowercase member spelling are supported for implemented
objects. Arbitrary mixed case, late-bound COM VARIANT conversions, HRESULT errors,
VBScript/ActiveScript engine selection and the original singleton script scope
are not reproduced. Recovery workers have independent globals per session.

Script effects remain allowlisted and execution occurs in disposable workers.
Each event permits 32 effects and execution watchdogs remain 1000 ms for evaluation
and 500 ms for callbacks. Commands/display chains stop after 128 actions within
one second. No native credential, filesystem, arbitrary socket or COM handle is
included in worker context. Owner profile updates reject foreign IDs at both
worker and host boundaries. Script failures drop the worker event's effects;
host failures during effect application can leave earlier effects applied and
are not an atomic transaction.

## Remaining architecture, not merely missing names

| Family | Required work for original parity |
| --- | --- |
| Alias/Aliases | Stable live rule objects, StopProcessing/Folder writes, scope-aware collections, original indexing failures; editor/runtime mutation synchronization. |
| FindString/Trigger/Triggers | Live matching fields, all trigger flags, detached NewTrigger, AddCopy/Delete, collection Active and nested collections; stable object lifetime after deletion. |
| Puppet/Puppets | Complete connection routing, prefix rules, auto-connect, logging and scoped rules; a fake empty collection would conceal the missing runtime. |
| Window_Main/Windows/App.NewWindow | Full owned window objects, scripting-created windows, current callback window semantics and cross-window permission model; native lifetime invalidation. |
| Window_Text/FixedText/Graphics | Script-owned native dockable windows; fixed cursor drawing, pixel surface/pen state/text, events, titles/HWND; true arbitrary docking. |
| Window_Events/SpawnTabs/Docking | Close/key/mouse and tab activation delivery, numeric HWND lifetime checks, documented/source MakeDocking discrepancy investigation. |
| Socket/SocketServer/DNS | Native broker for outbound and listening sockets, bytes and event delivery, endpoint/listen grants, cancellation and owner cleanup. |
| WebView | Separate webview host API, display regex/capture hooks, GMCP prefix handlers, alias processing and history injection; not interchangeable with `window.connection`. |
| Beip / external COM | COM class registration, type library, ROT activation, external object identity and marshaling. Ordinary worker JavaScript cannot substitute for OLE automation. |
| Filesystem / ActiveX | Exact synchronous source-compatible proxy bridge with explicit local capabilities and marshaled IDispatch, described below. Merely changing APIs to promises breaks existing scripts. |

## Native capability design for exact source compatibility

This is a design contract, **not implemented native functionality**. Existing
calls like `app.ActiveXObject("Scripting.FileSystemObject").OpenTextFile(path)`
must remain synchronous to preserve original code. `window.RunFile(path)` must
execute the loaded source in the current script environment before returning.

1. A user-selected script bundle receives a digest-bound capability manifest.
   Grants name the permitted directory roots, read/write/create operations,
   network destinations/listen ports, and COM ProgID/CLSID plus method/property
   allowlists. A script update invalidates or re-reviews its grants. No global
   “allow all COM” checkbox is sufficient for a controlled mode.
2. A separate broker process owns an STA COM apartment and opaque object handles.
   Handles are random, scoped to `(sessionId, workerGeneration, grantId)`, never
   raw pointers/HWNDs. The native host independently validates that tuple and
   typed arguments on every call. Child COM objects inherit no broader rights.
3. Exact synchronous return values require a worker-safe synchronous rendezvous:
   either a supported isolated-origin SharedArrayBuffer/Atomics wait channel to
   the host, or an embedded isolated JavaScript runtime with native synchronous
   RPC. Ordinary asynchronous `postMessage` or promises alone do not preserve
   original source compatibility. A transport capability experiment must prove
   this in the actual WebView2 packaging before selecting the architecture.
4. The host UI thread never blocks on script code. Broker operations have deadlines
   and cancellation. Script/broker timeout terminates that generation; late replies
   cannot reuse IDs. COM callbacks queue to the owning worker with an explicit
   bounded reentrancy policy, including object destruction and DISPID invocation.
5. Filesystem enforcement resolves handles/canonical final paths under granted
   roots, rejects network/device/ADS escape, checks reparse traversal and races,
   and applies byte/handle/write quotas. `RunFile` is a distinct read-and-execute
   permission; config/vault access is never implicitly inherited from file read.
6. Only reviewed adapters may instantiate `Scripting.FileSystemObject`, shell,
   XMLHTTP or application COM objects. These differ materially in capability:
   shell Run/Exec, HTTP network access and arbitrary automation each need their
   own grants. Unsupported members fail explicitly rather than returning success.
7. Tests must run unchanged original scripts against both original and recovery
   using temporary files and loopback servers: sync return values, byte arrays,
   late binding/case, event argument order, errors, cross-owner forged handles,
   disconnect/timeout cleanup, reparse escape and grant revocation. Passing a
   proxy unit test alone does not establish native parity.

## Verification and integration

`node recovery/tests/scripts_test.cjs` covers the prior 22 worker/runtime cases.
`node recovery/tests/script_objects_test.cjs` exercises the new object contracts,
including original Run semantics, editable lines and COLORREF, owner mutation,
variables, logging, explicit native gaps and forged effect rejection.

`features.js` owns context/effect integration. `beforeDisplay(session,node)` must
be awaited after trigger formatting and before logging/dock copies. It returns
true to gag; `applyLine(node,snapshot)` applies a validated mutable trigger result.
Native reconnect, tab title prefix, close/pause event delivery and actual packaged
rendering require host integration and acceptance; focused worker tests do not
by themselves prove those paths. Track the root task's app verification evidence
before changing this statement to a packaged acceptance claim.

Realistic examples are in `recovery/examples/scripts/`. They operate only on the
current session, and the WHO example intercepts output only after the user sends
WHO. The unchanged documented receive/send patterns remain in the existing suite.

<!-- IDL-CENSUS: generated from the checked-in IDL; update when source changes. -->

## Complete source member census

| Interface | Members in current IDL |
| --- | --- |
| Window_Properties | `Title`, `HWND` |
| Window_Events | `SetOnClose`, `SetOnMouseMove`, `SetOnKey` |
| ArrayUInt | `Item`, `Count` |
| TextWindowLine | `Length`, `String`, `HTMLString`, `Insert`, `Delete`, `Color`, `BgColor`, `Bold`, `Italic`, `Underline`, `Strikeout`, `Flash`, `FlashMode`, `Blink` |
| Window_Text | `Properties`, `Paused`, `Create`, `CreateHTML`, `Add`, `Write`, `WriteHTML`, `SetOnPause` |
| Window_SpawnTabs | `SetOnTabActivate` |
| Window_Input | `SetSel`, `GetSelStart`, `GetSelEnd`, `Length`, `Prefix`, `Title`, `Set`, `Get` |
| Log | `Write`, `WriteLine`, `FileName` |
| Connection | `Send`, `SetOnSend`, `Transmit`, `Receive`, `SetOnReceive`, `Display`, `SetOnDisplay`, `SetOnGMCP`, `SetOnConnect`, `SetOnDisconnect`, `IsConnected`, `Reconnect`, `IsLogging`, `Log`, `World`, `Character`, `Puppet`, `Window_Main` |
| Docking | `Dock` |
| Window_Main | `Output`, `History`, `Input`, `Connection`, `UserData`, `GetInput`, `GetSpawnTabs`, `Close`, `SetOnCommand`, `SetOnActivate`, `SetOnClose`, `Run`, `RunFile`, `CreateDialogConnect`, `TitlePrefix`, `Title`, `Activity`, `AddImportantActivity`, `GetVariable`, `SetVariable`, `DeleteVariable` |
| Windows | `Item`, `Count` |
| Window_FixedText | `Events`, `Properties`, `CursorX`, `CursorY`, `Clear`, `Write` |
| Timer | `UserData`, `Kill`, `Active` |
| Window_Graphics | `Events`, `Properties`, `Width`, `Height`, `Clear`, `SetPixel`, `GetPixel`, `SetPen`, `MoveTo`, `LineTo`, `Text` |
| Socket | `Connect`, `Close`, `IsConnected`, `Send`, `SetOnReceive`, `SetOnConnect`, `SetOnDisconnect`, `SetFlag`, `UserData` |
| WebView | `CloseWindow`, `IsConnected`, `SetOnConnect`, `SetOnDisconnect`, `Send`, `SetOnSend`, `Receive`, `SetOnReceive`, `Display`, `SetOnDisplay`, `ClearOnDisplay`, `SetOnDisplayCapture`, `ClearOnDisplayCapture`, `SendGMCP`, `SetOnGMCP`, `ClearOnGMCP`, `ProcessAliases`, `AddToInputHistory`, `GetPropertyString` |
| SocketServer | `Shutdown` |
| ReverseDNS | Hidden lifetime object, no public methods |
| ForwardDNS | Hidden lifetime object, no public methods |
| App | `BuildNumber`, `BuildDate`, `Version`, `Worlds`, `Windows`, `Triggers`, `Aliases`, `ConfigPath`, `ActiveXObject`, `NewTrigger`, `NewWindow_FixedText`, `NewWindow_Graphics`, `NewWindow_Text`, `NewWindow`, `SetOnNewWindow`, `CreateInterval`, `CreateTimeout`, `New_Socket`, `New_SocketServer`, `ReverseDNSLookup`, `ForwardDNSLookup`, `IsAddress`, `PlaySound`, `StopSounds`, `OutputDebugHTML`, `OutputDebugText` |
| Beip | `Window`, `App` |
| FindString | `MatchText`, `RegularExpression`, `MatchCase`, `StartsWith`, `EndsWith`, `WholeWord` |
| Trigger | `Delete`, `FindString`, `Disabled`, `StopProcessing`, `OncePerLine`, `AwayPresent`, `AwayPresentOnce`, `Away`, `Triggers` |
| Triggers | `Item`, `Count`, `Active`, `Delete`, `AddCopy` |
| Alias | `StopProcessing`, `Folder` |
| Aliases | `Item`, `Count` |
| Puppet | `Name`, `Info`, `ReceivePrefix`, `SendPrefix`, `LogFileName`, `AutoConnect`, `ConnectWithPlayer`, `Triggers`, `Aliases` |
| Puppets | `Item`, `Count` |
| Character | `Shortcut`, `Name`, `Connect`, `Info`, `LogFileName`, `LastUsed`, `TimeCreated`, `Triggers`, `Aliases`, `Puppets` |
| Characters | `Item`, `Count` |
| World | `Shortcut`, `Name`, `Info`, `Host`, `Characters`, `Triggers`, `Aliases` |
| Worlds | `Item`, `Count` |

## Preview 0.13 continuation limits

Trigger callbacks use captured effects within the same owned command transaction.
The host checks session, connection epoch, rule worker and script runtime identity
before and after waits. Updated variables, away state and line text feed later
matching. OnDisplay finalization runs after the trigger transaction, avoiding a
nested queue deadlock. Script edits are validated against the returned final text
and styles before they reach the incremental DOM renderer.

Synchronous reads immediately after a deferred host Run/Set effect still do not
reproduce COM calls. Reentrant Receive, original prompt pseudo-receive, all original
native APIs/languages and UTF-8 indexing remain separate work. Pending work is
cancelled on rule-tree replacement rather than resumed in a different tree.

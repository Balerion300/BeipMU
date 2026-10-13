// Adapted from Documentation/ScriptingExamples.md. Load into the Scripts editor.
// Send WHO yourself. This script sends no command automatically.
var capturingWho = false;
window.connection.SetOnSend(function (text) {
    if (text.toUpperCase() === 'WHO') capturingWho = true;
    return false;
});
window.connection.SetOnReceive(function (text, owner) {
    if (!capturingWho) return false;
    var line = owner.output.Create('[WHO] ' + text);
    line.Color(0, 5, 0x00ffff); // Windows COLORREF: yellow.
    line.Bold(0, 5);
    owner.output.Add(line);
    if (/players? (?:are |is )?connected/i.test(text)) capturingWho = false;
    return true;
}, window);


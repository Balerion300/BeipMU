// Display-stage formatting after ANSI/trigger processing. No network sends.
window.connection.SetOnDisplay(function (line) {
    var match = /HP:\s*(\d+)\/(\d+)/.exec(line.String);
    if (!match) return false;
    var current = Number(match[1]), maximum = Number(match[2]);
    var low = maximum > 0 && current / maximum < 0.25;
    line.Color(match.index, match.index + match[0].length, low ? 0x0000ff : 0x00ff00);
    line.Bold(match.index, match.index + match[0].length, low);
    return false;
});

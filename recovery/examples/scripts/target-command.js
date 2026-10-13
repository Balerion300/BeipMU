// /target NAME persists an owner-character variable and prepares a command draft.
// No connection send occurs until the user sends the prepared draft.
window.SetOnCommand(function (command, parameters, owner) {
    if (command.toLowerCase() !== 'target') return false;
    var name = parameters.trim();
    if (!name) {
        owner.output.Write('Current target: ' + (owner.GetVariable('target') || '(none)'));
        return true;
    }
    owner.SetVariable('target', name);
    owner.Input.Set('look ' + name);
    owner.Input.SetSel(5, owner.Input.Length);
    owner.output.Write('Prepared a look command for ' + name + '.');
    return true;
}, window);


//NOT SURE HOW TO GET CLIENT IN HERE YET SO THIS FILE DOES NOTHING


// Called every time a message comes in
function onMessageHandler (target, context, msg, self) {
    if (self) { return; } // Ignore messages from the bot

    // Remove whitespace from chat message
    const commandName = msg.trim();

    // If the command is known, let's execute it
    if (commandName === '!dice') {
        const num = rollDice();
        client.say(target, `You rolled a ${num}`);
        console.log(`* Executed ${commandName} command`);
    } else {
        console.log(`* Unknown command ${commandName}`);
    }
}

function rollDice () {
    const sides = 6;
    return Math.floor(Math.random() * sides) + 1;
}

function onConnectedHandler (addr, port) {
    console.log(`* Connected to ${addr}:${port}`);
}

module.exports = {
    onMessageHandler: onMessageHandler,
    onConnectedHandler: onConnectedHandler
}
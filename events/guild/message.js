require('dotenv').config();
module.exports = (Discord, client, message) => {
    const prefix = process.env.PREFIX;
    if (!message.content.startswith(prefix) || message.author.bot) return;
    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();

    const command = client.commands.get(cmd) || client.commands.find(a => a.aliases && a.aliases.includes(cmd.toLowerCase()));

    if (command) command.execute(client, message, args, Discord);

}
try {
    command.execute(message, args, cmd, client, Discord);
} catch (err) {
    message.reply("there was an error trying to execute this...");
    console.log(err);
}
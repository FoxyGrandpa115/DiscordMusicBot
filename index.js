const Discord = require('discord.js');

//INTENTS ARE IMPORTANT--  no "GUILD_VOICE_STATES" == NO AUDIO 
const client = new Discord.Client({
    presence: {
        status: 'available',
        afk: false,
        activities: [{
            name: 'In the Garden',
            type: 'SLEEPING'
        }],
    },
    intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MESSAGE_REACTIONS", "GUILD_VOICE_STATES"]
});
intents = Discord.Intents.default
var servers = {};

client.queue = new Map();

const prefix = '!';
const fs = require('fs');
client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${ file }`);
    client.commands.set(command.name, command);
}

client.on('ready', () => {
    console.log('MangoBot is online!');
    // Playing in my support server
    client.user.setActivity("in my garden", { type: "PLAYING" });

    // // Streaming <name of stream>
    // client.user.setActivity({ type: "STREAMING", url: "<twich url>" });

    // // Watching over xx servers
    // client.user.setActivity(`over ${client.guilds.cache.size} servers`, {
    //     type: "WATCHING",
    // });

    // // Listening to xxx users
    // client.user.setActivity(
    //     `to ${client.guilds.cache
    //   .map((guild) => guild.memberCount)
    //   .reduce((p, c) => p + c)} users`, { type: "LISTENING" }
    // );
});

//setting prefix
client.on('message', message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();
    const guild = message.guild

    if (command === 'play') {
        client.commands.get('play').execute(message, args, command);
    } else
    if (command === 'website') {
        client.commands.get('website').execute(message, args);
    } else if (command === 'skip') {
        client.commands.get('play').skip_song(message, guild);
    } else if (command === 'stop') {
        client.commands.get('play').stop_song(message, guild);
    } else if (command === 'help') {
        client.commands.get('help').info(message, guild);
    }
})





client.login('OTkwMzM3NTE5NjIxMTQwNTMy.GAr8Vk.kYRo2iWD4WXMDVwIFgTb-A8TYl1DjfvsfEuZSQ');
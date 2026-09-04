const Discord = require('discord.js');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const fs = require('fs');
require('dotenv').config(); 

const client = new Client({
    presence: {
        status: 'online', 
        afk: false,
        activities: [{
            name: 'In the Garden',
            type: ActivityType.Custom 
        }],
    },
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates, // Mandatory for audio streaming functionality
        GatewayIntentBits.MessageContent    // CRITICAL for reading prefix commands
    ]
});

var servers = {};
client.queue = new Map();
const prefix = '!';

// Load commands
client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

// Ready Event
client.on('ready', () => {
    console.log('MangoBot is online!');
    
    // UPDATED FOR V14: Using ActivityType enum instead of string literal strings
    client.user.setActivity("in my garden", { type: ActivityType.Playing });
});

// UPDATED FOR V14: Swapped 'message' out for 'messageCreate'
client.on('messageCreate', message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    
    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();
    const guild = message.guild;

    // Check if the command exists inside our collection before running it
    const cmdTarget = client.commands.get(command) || client.commands.get('play'); 
    
    if (command === 'play') {
        client.commands.get('play').execute(message, args, command);
    } else if (command === 'website') {
        client.commands.get('website').execute(message, args);
    } else if (command === 'skip') {
        client.commands.get('play').skip_song(message, guild);
    } else if (command === 'stop') {
        client.commands.get('play').stop_song(message, guild);
    } else if (command === 'help') {
        client.commands.get('help').info(message, guild);
    } else if (command === 'queue') {
        client.commands.get('play').queue(message, guild);
    } else if (command === 'pause') {
        client.commands.get('play').execute(message, guild, command);
    } else if (command === 'resume') {
        client.commands.get('play').execute(message, guild, command);
    }
});

//Keep your token secure
client.login(process.env.DISCORD_TOKEN);

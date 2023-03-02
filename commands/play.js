const ytdl = require('ytdl-core'); // causes random interruption sometimes...
const play = require('play-dl')

const ytSearch = require('yt-search');
const usetube = require('usetube');
const { channel } = require('diagnostics_channel');
const { getVoiceConnection, joinVoiceChannel, AudioPlayerStatus, createAudioResource, getNextResource, createAudioPlayer, NoSubscriberBehavior } = require('@discordjs/voice');
const { createReadStream } = require('fs');
const { Queue } = require('discord-player');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { url } = require('inspector');

//queue(message.guild.id, queue_constructor object { voice channel, text channel, connection, song[] })
//Global queue for bot
const queue_ = new Map();


module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Plays audio in voice channel'),
    name: 'play',
    aliases: ['skip', 'stop'],

    cooldown: 0,
    description: 'command for activating the Music Bot',
    async execute(message, args, command) {

        const voice_channel = message.member.voice.channel;
        if (!voice_channel) return message.channel.send('get in the channel to execute this command');
        const permissions = voice_channel.permissionsFor(message.client.user);
        if (!permissions.has('CONNECT')) return message.channel.send('You dont have the right permissions to play this command');
        if (!permissions.has('SPEAK')) return message.channel.send('You dont have the right permissions to play this command');

        const server_queue = queue_.get(message.guild.id)

        if (!args.length && command == 'play') return message.channel.send('need second argument');
        let song = {}
        if (command == 'pause') {
            if (!server_queue) return message.channel.send('Nothing is currently playing');
            if (server_queue.player._state.status == 'paused') return message.channel.send('Music is already paused');
            server_queue.player.pause();
            console.log(server_queue.player._state.status)
            await message.channel.send(`Paused playback. ⏸`)
            return;
        } else if ((command == 'resume')) {
            if (!server_queue) return message.channel.send('Nothing is currently playing');
            if (server_queue.player._state.status == 'playing') return message.channel.send('Music is already playing');
            server_queue.player.unpause();
            console.log(server_queue.player._state.status)
            await message.channel.send(`Resumed playback. ⏯`)
            return;
        }
        if (command === 'play') {

            const queue_constructor = {
                voice_channel: voice_channel,
                text_channel: message.channel,
                connection: null,
                songs: [],
                paused: false,
                player: null
            }
            //playlist functionality.. dont think works yet
            if (args[0].match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
                const id = args[0].split("=");
                message.channel.send('Fetching playlist videos...')
                const playlist = await usetube.getPlaylistVideos(id[1]);
                console.log(id);
                for (i = 0; i < playlist.length; i++) {
                    let prefix = 'https://www.youtube.com/watch?v='
                    let suffix = playlist[i].id
                    let url = prefix + suffix;
                    console.log(url);
                    try {
                        let video = await play.video_info(url);
                        if (video) {
                            song = { title: video.video_details.title, url: video.video_details.url, time: video.video_details.durationRaw }
                        } else {
                            message.channel.send('Error with URL provided')
                        }
                    } catch (err) {
                        message.channel.send('There was an error loading playlist video! Make sure each video is available.');
                        throw err;
                    }
                    queue_constructor.songs.push(song);
                    //return message.channel.send(`**${song.title}** added to the queue ✅`);
                }
                // playlistQueue(message, guild)
                // plays(message.guild, queue_constructor.songs[0], queue_constructor, message, args[0]);
            } else if (ytdl.validateURL(args[0])) { //detects a URL
                let video = await play.video_info(args[0]);
                if (video) {
                    song = { title: video.video_details.title, url: video.video_details.url, time: video.video_details.durationRaw }
                } else {
                    message.channel.send('Error with URL provided')
                }
            } else {
                //not a url...
                const video_finder = async (query) => {
                    const result = await play.search(query);
                    return (result.length > 1) ? result[0] : null;
                }
                const video = await video_finder(args.join(' '));
                if (video) {
                    song = { title: video.title, url: video.url, time: video.durationRaw }
                } else {
                    message.channel.send('Error finding video')
                }
                //let yt_info = await play.search(args, )
                //song = { title: yt_info[0].title, url: yt_info[0].url, time: yt_info[0].durationRaw }
            }
            if (!server_queue) {

                queue_.set(message.guild.id, queue_constructor);
                queue_constructor.songs.push(song);

                //trying to connect to channel 
                try {
                    const connection = joinVoiceChannel({
                        channelId: voice_channel.id,
                        guildId: voice_channel.guild.id,
                        adapterCreator: voice_channel.guild.voiceAdapterCreator,
                    });
                    queue_constructor.connection = connection;
                    const song_queue = queue_.get(message.guild.id)
                    //important - where video player is called...
                    //video_player(message.guild, queue_constructor.songs[0], queue_, message);
                    plays(message.guild, queue_constructor.songs[0], queue_constructor, message, args[0]);
                    //queue_.delete(message.guild.id);
                } catch (err) {
                    queue_.delete(message.guild.id);
                    message.channel.send('There was an error connecting!');
                    throw err;
                }
            } else if (server_queue.player._state.status == 'playing') {
                server_queue.songs.push(song);
                return message.channel.send(`**${song.title}** added to the queue ✅`);
            } else if (server_queue.player._state.status == 'idle') {
                server_queue.songs.push(song);
                queue_.set(message.guild.id, queue_constructor);
                //remaking connection
                try {
                    const connection = joinVoiceChannel({
                        channelId: voice_channel.id,
                        guildId: voice_channel.guild.id,
                        adapterCreator: voice_channel.guild.voiceAdapterCreator,
                    });
                    queue_constructor.connection = connection;
                    plays(message.guild, server_queue.songs[0], queue_constructor, message, args[0]);
                } catch (err) {
                    queue_.delete(message.guild.id);
                    message.channel.send('There was an error connecting!');
                    throw err;
                }
            }
        }
    },
    skip_song(message, guild) {
        const voice_channel = message.member.voice.channel;
        const song_queue = queue_.get(guild.id);
        if (!voice_channel) return message.channel.send('get in the channel to execute this command');
        const permissions = voice_channel.permissionsFor(message.client.user);
        if (!permissions.has('CONNECT')) return message.channel.send('You dont have the right permissions to play this command');
        if (!permissions.has('SPEAK')) return message.channel.send('You dont have the right permissions to play this command');
        if ((song_queue.songs.next || song_queue.songs) == null) {
            message.channel.send(`No song to skip to..`);
        }

        song_queue.songs.shift();
        //skipping
        message.channel.send(`Skipping song.. ⏩`);
        plays(guild, song_queue.songs[0], song_queue, message);
    },
    stop_song(message, guild) {
        const voice_channel = message.member.voice.channel;
        if (!voice_channel) return message.channel.send('get in the channel to execute this command');
        const song_queue = queue_.get(guild.id);
        const player = createAudioPlayer();
        song_queue.connection.subscribe(player);
        song_queue.songs.shift();
        //stopping
        if(song_queue.connection){
            message.channel.send(`Ending song queue.. 🛑`);
            song_queue.connection.destroy();
            queue_.delete(guild.id);
        }
    },
    //testing queue function which lists out queued songs
    queue(message, guild) {
        const song_queue = queue_.get(guild.id);
        try{
            let output = []
            if(song_queue){
                for (i = 0; i < song_queue.songs.length; i++) {
                    output.push(`🎶  **${song_queue.songs[i].title}** : **${song_queue.songs[i].time}** 🎼` + '\n')
                }
                
            console.log(song_queue.songs.length)
            console.log(output)
            message.channel.send(`Songs in queue 📃:`)
            message.channel.send(`${output}`)
            }else message.channel.send('No music queue yet!')
        }catch (err) {
            queue_.delete(message.guild.id);
            message.channel.send('There was an error getting the queue! Maybe nothing is playing...');
            throw err;
        }
    }
}
//listing playlist queue
const playlistQueue = async (message, guild) => {
    const song_queue = queue_.get(guild.id);
    message.channel.send(`Songs in queue 📃:`)
    let output = []
    for (i = 0; i < song_queue.songs.length; i++) {
        output.push(`🎶  **${song_queue.songs[i].title}** : **${song_queue.songs[i].time}** 🎼` + '\n')
    }
    console.log(song_queue.songs.length)
    console.log(output)
    message.channel.send(`${output}`)
}
//play-dl video player
const plays = async (guild, song, queue_, message, paused, curPlayer) => {

    if (!queue_) {
        await queue_.text_channel.send(`No more songs in queue.. see you next time! 👋`)
        if (queue_.connection) {
            queue_.connection.destroy();
        }
        return;
    } else if (!song) {
        //await queue_.text_channel.send(`error getting song`)
        if (queue_.connection) {
            setTimeout(() => queue_.connection.destroy(), 60_000);
        }
        return;
    }

    let stream = await play.stream(song.url)

    let resource = createAudioResource(stream.stream, {
        inputType: stream.type
    })

    let player = createAudioPlayer({
        behaviors: {
            noSubscriber: NoSubscriberBehavior.Play
        }
    })
    queue_.player = player
    queue_.connection.subscribe(player)

    player.play(resource)
    await queue_.text_channel.send(`🎶 Now playing **${song.title}** 🎼 : **${song.time}**`)

    curPlayer = player
    console.log(curPlayer);
    player.on(AudioPlayerStatus.Idle, () => {
        queue_.songs.shift();
        plays(guild, queue_.songs[0], queue_);
    });
}
const ytdl = require('ytdl-core'); // causes random interruption sometimes...
const play = require('play-dl')
const ytdlProcess = require('youtube-dl-exec')
const  {spawn, execSync} = require('child_process')

const ytSearch = require('yt-search');
const usetube = require('usetube');
const { channel } = require('diagnostics_channel');
const { getVoiceConnection, joinVoiceChannel, AudioPlayerStatus, createAudioResource,
     VoiceConnectionStatus, entersState, getNextResource, createAudioPlayer, NoSubscriberBehavior, StreamType } = require('@discordjs/voice');
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
                }
            } else if (ytdl.validateURL(args[0])) { // detects a URL
                let video = await play.video_info(args[0]);
                if (video) {
                    song = { title: video.video_details.title, url: video.video_details.url, time: video.video_details.durationRaw }
                } else {
                    message.channel.send('Error with URL provided')
                }
            } else {
                // === FIXED & SECURED SEARCH ENGINE LAYER ===
                const video_finder = async (query) => {
                    try {
                        // 1. Attempt primary lookup using play-dl
                        const result = await play.search(query, { source: { youtube: 'video' }, limit: 1 });
                        if (result && result.length > 0) return result[0];
                    } catch (err) {
                        console.warn('⚠️ play-dl search layout failed, attempting yt-search fallback...', err.message);
                    }

                    try {
                        // 2. Fallback to yt-search if play-dl hits internal page changes
                        const ytSearch = require('yt-search');
                        const fallbackResult = await ytSearch(query);
                        if (fallbackResult && fallbackResult.videos.length > 0) {
                            return fallbackResult.videos[0];
                        }
                    } catch (fallbackErr) {
                        console.error('❌ Both search scrapers failed:', fallbackErr.message);
                    }
                    return null;
                };

                const video = await video_finder(args.join(' '));
                if (video) {
                    // Both play-dl and yt-search match these property mappings perfectly
                    song = { title: video.title, url: video.url, time: video.durationRaw || video.timestamp }
                } else {
                    return message.channel.send('Error finding video or search engines are parsing incorrectly.')
                }
            }
            
            if (!server_queue) {
                queue_.set(message.guild.id, queue_constructor);
                queue_constructor.songs.push(song);

                try {
                    const connection = joinVoiceChannel({
                        channelId: voice_channel.id,
                        guildId: voice_channel.guild.id,
                        adapterCreator: voice_channel.guild.voiceAdapterCreator,
                    });
                    queue_constructor.connection = connection;
                    plays(message.guild, queue_constructor.songs[0], queue_constructor, message, args[0]);
                } catch (err) {
                    queue_.delete(message.guild.id);
                    message.channel.send('There was an error connecting!');
                    throw err;
                }
            } else if (server_queue.player && server_queue.player._state.status == 'playing') {
                server_queue.songs.push(song);
                return message.channel.send(`**${song.title}** added to the queue ✅`);
            } else if (server_queue.player && server_queue.player._state.status == 'idle') {
                server_queue.songs.push(song);
                queue_.set(message.guild.id, queue_constructor);
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
        try {
            //Verify if the queue exists and actually has tracks inside it
            if (song_queue && song_queue.songs.length > 0) {
                let output = [];
                
                for (let i = 0; i < song_queue.songs.length; i++) {
                    output.push(`🎶  **${song_queue.songs[i].title}** : **${song_queue.songs[i].time}** 🎼\n`);
                }
                
                //Validate length explicitly instead of checking array truthiness
                if (output.length > 0) {                
                    console.log(`Queue items count: ${song_queue.songs.length}`);
                    
                    // Send the header alert
                    message.channel.send(`Songs in queue 📃:`);
                    
                    // 3. Use .join('') to combine the array lines into a single string cleanly
                    message.channel.send(output.join(''));
                } else {
                    message.channel.send('The queue is currently empty!');
                }
            } else {
                message.channel.send('No music queue yet! Nothing is playing.');
            }
        } catch (err) {
            // Avoid destructive wipes inside basic read operations unless absolutely critical
            console.error('Error fetching queue text block:', err);
            message.channel.send('There was an error getting the queue!');
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

    //Check if the root queue tracking object exists at all
    if (!queue_) {
        console.log("[DEBUG] Play function called but no queue object exists.");
        return; 
    }

    //Check if the song object is missing or empty
    if (!song || !song.url) {
        // Send a message cleanly since we verified queue_ is valid
        await queue_.text_channel.send(`No more songs in queue.. see you next time! 👋`);
        
        if (queue_.connection) {
            // Disconnect immediately, or wrap it in your setTimeout if you prefer a delay
            queue_.connection.destroy();
        }
        return;
    }


    try {
        // 1. Force the Voice Connection to confirm it's completely ready
        // If it isn't fully established within 5 seconds, it will catch and throw an error.
        await entersState(queue_.connection, VoiceConnectionStatus.Ready, 5_000);
        console.log(" Voice UDP network tunnel is fully established!");

        // 2. Fetch the direct media URL string
        const rawUrl = execSync(`/home/foxy/.local/bin/yt-dlp -g -f 251 "${song.url}"`, {
            encoding: 'utf-8'
        }).trim();

        // 3. Process the stream cleanly without compression lag
        const ffmpegProcess = spawn('ffmpeg', [
            '-reconnect', '1',
            '-reconnect_streamed', '1',
            '-reconnect_delay_max', '5',
            '-i', rawUrl,
            '-c', 'copy',
            '-f', 'webm',
            'pipe:1'
        ]);

        const audioStream = ffmpegProcess.stdout;

        let resource = createAudioResource(audioStream, {
            inputType: StreamType.WebmOpus
        });

        let player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play
            }
        });
        
        queue_.player = player;
        queue_.connection.subscribe(player);

        // 4. Play the resource AFTER confirming connection is alive
        player.play(resource);
        await queue_.text_channel.send(`🎶 Now playing **${song.title}** 🎼 : **${song.time}**`);

        curPlayer = player;

        player.on(AudioPlayerStatus.Idle, () => {
            if (!ffmpegProcess.killed) ffmpegProcess.kill();
            queue_.songs.shift();
            const nextSong = queue_.songs;
            plays(guild, nextSong, queue_, message, paused, curPlayer);
        });

        player.on('error', error => {
            console.error(`Audio Player Error: ${error.message}`);
            if (!ffmpegProcess.killed) ffmpegProcess.kill();
        });

    } catch (error) {
        console.error('🔴 Voice Pipeline State Timeout:', error);
        await queue_.text_channel.send(`❌ Network connection timed out. Trying to jump to next song...`);
        
        queue_.songs.shift();
        plays(guild, queue_.songs, queue_);
    }
};

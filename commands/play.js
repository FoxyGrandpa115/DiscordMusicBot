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
    async execute(message, args, queue, command) {

        const voice_channel = message.member.voice.channel;
        if (!voice_channel) return message.channel.send('get in the channel to execute this command');
        const permissions = voice_channel.permissionsFor(message.client.user);
        if (!permissions.has('CONNECT')) return message.channel.send('You dont have the right permissions to play this command');
        if (!permissions.has('SPEAK')) return message.channel.send('You dont have the right permissions to play this command');

        const server_queue = queue_.get(message.guild.id)

        if (!args.length) return message.channel.send('need second argument');
        let song = {}
            //console.log(message, args, command);
        if (command === 'play') {

        }
        //playlist functionality.. dont think works yet
        if (args[0].match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await usetube.getPlaylistVideos(args[0]);
            for (i = 0; i < playlist.length; i++) {
                const song_info = await ytdl.getInfo(args[i]);
                const songplay_info = await play_dl.getInfo(args[i]);
                song = { title: song_info.videoDetails.title, url: song_info.videoDetails.video_url, time: song_info.videoDetails.lengthSeconds % 3600 }
                song_play = { title: songplay_info.videoDetails.title, url: songplay_info.videoDetails.video_url, time: songplay_info.videoDetails.lengthSeconds % 3600 }
                    //testing play-dl
                server_queue.songs.push(song_play);
            }
        } else if (ytdl.validateURL(args[0])) { //detects a URL
            plays_url(args[0]);
        } else {
            //not a url...
            const video_finder = async(query) => {
                const result = await ytSearch(query);
                return (result.videos.length > 1) ? result.videos[0] : null;
            }
            const video = await video_finder(args.join(' '));
            if (video) {
                song = { title: video.title, url: video.url, time: video.timestamp }
            } else {
                message.channel.send('Error finding video')
            }
        }
        if (!server_queue) {
            const queue_constructor = {
                voice_channel: voice_channel,
                text_channel: message.channel,
                connection: null,
                songs: []
            }
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
                //important - where video player is called...
                video_player(message.guild, queue_constructor.songs[0], queue_);

                //queue_.delete(message.guild.id);
            } catch (err) {
                queue_.delete(message.guild.id);
                message.channel.send('There was an error connecting!');
                throw err;
            }
        } else {
            server_queue.songs.push(song);
            //queue_.delete(message.guild.id);
            return message.channel.send(`**${song.title}** added to the queue ✅`);
        }
    },
    skip_song(message, guild) {
        const song_queue = queue_.get(guild.id);
        song_queue.songs.shift();
        //skipping
        message.channel.send(`Skipping song.. ⏩`);
        video_player(guild, song_queue.songs[0], queue_);
    },
    stop_song(message, guild) {
        const song_queue = queue_.get(guild.id);
        const player = createAudioPlayer();
        song_queue.connection.subscribe(player);
        song_queue.songs.shift();
        //stopping
        message.channel.send(`Ending song queue.. 🛑`);
        song_queue.connection.destroy();
        queue_.delete(guild.id);
    },
    async plays(message, queue, command) {
        if (!message.member.voice.channel) return message.channel.send('Connect to a Voice Channel')

        const connection = joinVoiceChannel({
            channelId: message.member.voice.channel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator
        })


        let args = message.content.split('play')[1]
        let yt_info = await play.search(args, {
            limit: 1
        })

        console.log(yt_info[0].title)
        await message.channel.send(`🎶 Now playing **${yt_info[0].title}** 🎼 : **${yt_info[0].durationRaw}**`)

        let stream = await play.stream(yt_info[0].url)

        let resource = createAudioResource(stream.stream, {
            inputType: stream.type
        })

        let player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play
            }
        })

        player.play(resource)

        connection.subscribe(player)
        if (song == null) {
            await song_queue.text_channel.send(`No more songs in queue.. see you next time! 👋`)
            song_queue.connection.destroy();
            queue_.delete(guild.id);
            return;
        }
    },
    async plays_url(message, queue, command) {
        let args = message.content.split('play ')[1].split(' ')[0]

        let yt_info = await play.video_info(args)
        console.log(yt_info.video_details.title)
            //sending song info in channel
        await message.channel.send(`🎶 Now playing **${yt_info[0].title}** 🎼 : **${yt_info[0].durationRaw}**`)
        let stream = await play.stream_from_info(yt_info)

        let resource = createAudioResource(stream.stream, {
            inputType: stream.type
        })

        let player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play
            }
        })

        player.play(resource)

        connection.subscribe(player)
        if (song == null) {
            await song_queue.text_channel.send(`No more songs in queue.. see you next time! 👋`)
            song_queue.connection.destroy();
            queue_.delete(guild.id);
            return;
        }
    }
    //need to fix this later
    // pause(message, guild) {
    //     const player = createAudioPlayer();
    //     const song_queue = queue_.get(guild.id);
    //     if (!song_queue.connection) {
    //         return message.channel.send('No music is playing..');
    //     }
    //     if (!message.member.voice.channel) {
    //         return message.channel.send('Please enter voice channel to execute this command.');
    //     }
    //     //pausing
    //     message.channel.send(`Paused.`);
    //     player.pause();
    // },
    // resume(message, guild) {
    //     const player = createAudioPlayer();
    //     const song_queue = queue_.get(guild.id);
    //     if (!song_queue.connection) {
    //         return message.channel.send('No music is playing..');
    //     }
    //     if (!message.member.voice.channel) {
    //         return message.channel.send('Please enter voice channel to execute this command.');
    //     }
    //     //resuming
    //     message.channel.send(`Resumed.`);
    //     player.unpause();
    // }

}



//video player constant
const video_player = async(guild, song, queue_) => {
    const song_queue = queue_.get(guild.id);

    const player = createAudioPlayer();
    song_queue.connection.subscribe(player);
    if (song == null) {
        await song_queue.text_channel.send(`No more songs in queue.. see you next time! 👋`)
        song_queue.connection.destroy();
        queue_.delete(guild.id);
        return;
    }
    //const resource = createAudioResource(stream);
    //setting audio quality and highWaterMark values here (important)
    const stream = play_dl(song.url, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 }, { highWaterMark: 1 }); //< need to fix later when

    player.play(createAudioResource(stream, { seek: 0, volume: 1 }))
    player.on(AudioPlayerStatus.Idle, () => {
        song_queue.songs.shift();
        video_player(guild, song_queue.songs[0], queue_);
    });
    // song_queue.connection.play(stream, { seek: 0, volume: 0.5 })
    //     .on('finish', () => {
    //         song_queue.songs.shift();
    //         video_player(guild, song_queue.songs[0]);
    //     });
    await song_queue.text_channel.send(`🎶 Now playing **${song.title}** 🎼 : **${song.time}**`)
}
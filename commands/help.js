module.exports = {
    name: 'help',
    description: "prints out a list of commands",
    info(message, args) {
        message.channel.send('`---LIST OF COMMANDS---\n!help:  brings up this list.\n!play: plays a song from youtube using search query or url.\n!skip: skips to next song in queue.\n!stop: stops playback.`');
    }
}
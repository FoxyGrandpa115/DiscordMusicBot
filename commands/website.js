module.exports = {
    name: 'website',
    description: "sends personal website link",
    execute(message, args) {
        message.channel.send('https://foxygrandpa115.github.io/WebDevelopment/');
    }
}
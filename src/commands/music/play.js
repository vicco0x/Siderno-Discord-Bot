const { Command } = require("@src/structures");
const { Message, MessageEmbed, CommandInteraction } = require("discord.js");
const prettyMs = require("pretty-ms");
const { EMBED_COLORS } = require("@root/config");

module.exports = class Play extends Command {
  constructor(client) {
    super(client, {
      name: "play",
      description: "menti na canzuna i youtube",
      category: "MUSIC",
      botPermissions: ["EMBED_LINKS"],
      
      command: {
        enabled: true,
        usage: "<nomi-da-canzuni>",
        minArgsCount: 1,
        aliases: ["p"],
      },
      slashCommand: {
        enabled: true,
        options: [
          {
            name: "query",
            description: "nomi da canzuni o url",
            type: "STRING",
            required: true,
          },
        ],
      },
    });
  }

  /**
   * @param {Message} message
   * @param {string[]} args
   */
  async messageRun(message, args) {
    const query = args.join(" ");
    const response = await play(message, message.author, query);
    await message.reply(response);
  }

  /**
   * @param {CommandInteraction} interaction
   */
  async interactionRun(interaction) {
    const query = interaction.options.getString("query");
    const response = await play(interaction, interaction.user, query);
    await interaction.followUp(response);
  }
};

async function play({ member, guild, channel }, user, query) {
  if (!member.voice.channel) return "🚫 Nda u trasi nta nu canali vocali prima";
  let player = guild.client.musicManager.get(guild.id);

  if (player && member.voice.channel !== guild.me.voice.channel) {
    return "🚫 Nda u si nto stessu canali meu";
  }

  try {
    player = guild.client.musicManager.create({
      guild: guild.id,
      textChannel: channel.id,
      voiceChannel: member.voice.channel.id,
      volume: 50,
    });
  } catch (ex) {
    if (ex.message === "No available nodes.") {
      guild.client.logger.debug("No available nodes!");
      return "🚫 Non vaci Nodes!";
    }
  }

  if (player.state !== "CONNECTED") player.connect();
  let res;

  try {
    res = await player.search(query, user);
    if (res.loadType === "LOAD_FAILED") {
      if (!player.queue.current) player.destroy();
      throw res.exception;
    }
  } catch (err) {
    guild.client.logger.error("Search Exception", err);
    return "Capitau n'erruri nta ricerca";
  }

  let embed = new MessageEmbed().setColor(EMBED_COLORS.BOT_EMBED);
  let track;

  switch (res.loadType) {
    case "NO_MATCHES":
      if (!player.queue.current) player.destroy();
      return `Non trovai u restu i nenti cu nomi ${query}`;

    case "TRACK_LOADED":
      track = res.tracks[0];
      player.queue.add(track);
      if (!player.playing && !player.paused && !player.queue.size) {
        player.play();
        return "> 🎶 Canzuni jiungiuta a cuda";
      }

      embed
        .setAuthor({ name: "Canzuni jiungiuta a cuda" })
        .setDescription(` \`[${track.title}](${track.uri})\`

Jiungiuta i: ${track.requester.tag} | Durata: ❯ \`${prettyMs(track.duration, { colonNotation: true })} | Posizioni nta cuda: ${(player.queue.size - 0).toString()}`);

      if (typeof track.displayThumbnail === "function") embed.setThumbnail(track.displayThumbnail("hqdefault"));
      
      return { embeds: [embed] };

    case "PLAYLIST_LOADED":
      player.queue.add(res.tracks);
      if (!player.playing && !player.paused && player.queue.totalSize === res.tracks.length) {
        player.play();
      }

      embed
        .setAuthor({ name: "Added Playlist to queue" })
        .setDescription(res.playlist.name)
        .addField("Enqueued", `${res.tracks.length} songs`, true)
        .addField("Playlist duration", "`" + prettyMs(res.playlist.duration, { colonNotation: true }) + "`", true)
        .setFooter({ text: `Requested By: ${res.tracks[0].requester.tag}` });

      return { embeds: [embed] };

    case "SEARCH_RESULT":
      track = res.tracks[0];
      player.queue.add(track);
      if (!player.playing && !player.paused && !player.queue.size) {
        player.play();
        return "> 🎶 Canzuni jiungiuta a cuda";
      }

      embed
        .setAuthor({ name: "Added Song to queue" })
                .setDescription(` [${track.title}](${track.uri})

Jiungiuta i: ${track.requester.tag} | Durata: ❯ \`${prettyMs(track.duration, { colonNotation: true })}\` | Posizioni nta cuda: ${(player.queue.size - 0).toString()}`);

      
      return { embeds: [embed] };
  }
}

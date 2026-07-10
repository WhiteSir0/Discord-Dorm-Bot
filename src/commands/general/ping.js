import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('ping').setDescription('봇 응답 속도를 확인합니다.'),
  aliases: ['ping', '핑'],

  async execute(interaction) {
    const apiLatency = Date.now() - interaction.createdTimestamp;
    await interaction.reply(`🏓 Pong! API 지연: ${apiLatency}ms / 웹소켓: ${interaction.client.ws.ping}ms`);
  },

  async executePrefix(message) {
    const apiLatency = Date.now() - message.createdTimestamp;
    await message.reply(`🏓 Pong! API 지연: ${apiLatency}ms / 웹소켓: ${message.client.ws.ping}ms`);
  },
};

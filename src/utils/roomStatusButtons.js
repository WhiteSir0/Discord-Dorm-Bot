import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { nextDay } from './dateKst.js';

const STATUS_DAYS = ['월', '화', '수', '목'];

export function roomStatusButtons(weekStart) {
  const row = new ActionRowBuilder();
  let date = nextDay(weekStart);
  for (const label of STATUS_DAYS) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`room-status:${date}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary),
    );
    date = nextDay(date);
  }
  return row;
}

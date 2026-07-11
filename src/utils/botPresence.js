import { ActivityType } from 'discord.js';

const TRACKS = [
  'Brain Rot - Tokyo Manaka feat. Kasane Teto',
  'Encore Dance - MIMI feat. Kasane Teto',
  'numb numb - TAK feat. Hatsune Miku & Kasane Teto',
  'Mesmerizer - 32ki feat. Hatsune Miku & Kasane Teto',
  'Override - Yoshida Yasei feat. Kasane Teto',
  'Teto Territory - Oxi-P feat. Kasane Teto',
];

export function startBotPresence(client) {
  let index = Math.floor(Date.now() / 900_000) % TRACKS.length;
  const update = () => {
    client.user.setPresence({
      activities: [{ name: TRACKS[index], type: ActivityType.Listening }],
      status: 'online',
    });
    index = (index + 1) % TRACKS.length;
  };
  update();
  return setInterval(update, 15 * 60 * 1000);
}

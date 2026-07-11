import { ActivityType } from 'discord.js';

const TRACKS = [
  'Brain Rot - Tokyo Manaka feat. Kasane Teto',
  'Encore Dance - MIMI feat. Kasane Teto',
  'numb numb - TAK feat. Hatsune Miku & Kasane Teto',
  'Mesmerizer - 32ki feat. Hatsune Miku & Kasane Teto',
  'Override - Yoshida Yasei feat. Kasane Teto',
  'Teto Territory - Oxi-P feat. Kasane Teto',
  'PPPP - TAK feat. Hatsune Miku & Kasane Teto',
  'Approve Please, Genie! - Kasane Teto',
  'Execution Clap - TRAP CHICK feat. Kasane Teto',
  'Tetoris - Hiiragi Magnetite feat. Kasane Teto',
  'Machine Love - Jamie Paige feat. Kasane Teto',
  'Rot for Clout - Jamie Paige feat. Kasane Teto',
  'Birdbrain - Jamie Paige feat. Kasane Teto',
  'Cadmium Colors - Jamie Paige feat. Kasane Teto',
  'Liar Dancer - Masarada feat. Kasane Teto',
  'Igaku - Sasuke Haraguchi feat. Kasane Teto',
  'Hito Mania - Sasuke Haraguchi feat. Kasane Teto',
  'Ochame Kinou - LamazeP feat. Kasane Teto',
  'Triple Baka - LamazeP feat. Hatsune Miku, Kasane Teto & Akita Neru',
  'Yoshiwara Lament - Asa feat. Kasane Teto',
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

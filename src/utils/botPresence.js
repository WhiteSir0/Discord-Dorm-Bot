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
  'Fukkireta - LamazeP feat. Kasane Teto',
  'Song of the Eared Robot - Mimirobo-P feat. Kasane Teto',
  'Ultra Trailer - Masarada feat. Kasane Teto',
  'YABABAINA - SatapanP feat. Hatsune Miku, Kasane Teto & Zundamon',
  'DAI DAI DAI KIRAI - Kasane Teto',
  'Loop the Room - Tokyo Manaka feat. Kasane Teto',
  'Doomer - Tokyo Manaka feat. Kasane Teto',
  'Liar Macaron - Kasane Teto',
  'Obsolete Meat - Kasane Teto',
  'FIRE!!! - Jamie Paige feat. Kasane Teto',
  'Strawberry - Jamie Paige feat. Kasane Teto',
  'Science - Kasane Teto',
  'Magic Maid - Kasane Teto',
  'Ghost Experience - 32ki feat. Kasane Teto',
  'CandyCookieChocolate - HALLO CEL feat. Hatsune Miku & Kasane Teto',
  'Medicine - Sasuke Haraguchi feat. Kasane Teto',
  'Mimukauwa Nice Try - Nunununununununu feat. Kasane Teto',
  'Noda - Daibakuhashin feat. Hatsune Miku, Kasane Teto & Zundamon',
  'Odochina - Atena feat. Hatsune Miku & Kasane Teto',
  'Language of the Lost - RIProducer feat. Kasane Teto',
  'Pathological Facade - GHOST feat. Kasane Teto',
  'Spoken For - FLAVOR FOLEY feat. Kasane Teto',
  'Responsible Society - Masarada feat. Kasane Teto',
  'Honestly - Kasane Teto',
  'MINIMUM RAGE - Kasane Teto',
  'Melt Ice Cream - Kasane Teto',
];

export function startBotPresence(client) {
  let index = Math.floor(Date.now() / 180_000) % TRACKS.length;
  const update = () => {
    client.user.setPresence({
      activities: [{ name: TRACKS[index], type: ActivityType.Listening }],
      status: 'online',
    });
    index = (index + 1) % TRACKS.length;
  };
  update();
  return setInterval(update, 3 * 60 * 1000);
}

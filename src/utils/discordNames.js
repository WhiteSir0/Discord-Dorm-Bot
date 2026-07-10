export function serverDisplayName(interaction) {
  return interaction.member?.displayName
    ?? interaction.member?.nickname
    ?? interaction.user.globalName
    ?? interaction.user.username;
}

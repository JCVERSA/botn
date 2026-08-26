// In-memory command usage statistics tracker with realistic seeding values
const commandStats: Record<string, number> = {
  menu: 24,
  ai: 18,
  image: 14,
  ping: 9,
  joke: 7,
  quote: 5,
  owner: 3
};

export function getCommandStats(): Record<string, number> {
  return { ...commandStats };
}

export function incrementCommandStats(commandName: string) {
  const cleanName = commandName.toLowerCase().trim();
  if (cleanName) {
    commandStats[cleanName] = (commandStats[cleanName] || 0) + 1;
  }
}

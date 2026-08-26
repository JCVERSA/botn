export interface BotConfig {
  botName: string;
  prefix: string;
  botImage: string;
  ownerNumber: string;
  newsletterUrl: string;
  newsletterName: string;
  sessionString: string;
}

export const defaultConfig: BotConfig = {
  botName: "Nebula Bot",
  prefix: ".",
  botImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80",
  ownerNumber: "1234567890",
  newsletterUrl: "https://whatsapp.com/channel/0029VaNebulaChannel",
  newsletterName: "Nebula Bot Official News",
  sessionString: "",
};

let currentConfig = { ...defaultConfig };

export function getConfig(): BotConfig {
  return currentConfig;
}

export function updateConfig(newConfig: Partial<BotConfig>): BotConfig {
  currentConfig = { ...currentConfig, ...newConfig };
  return currentConfig;
}

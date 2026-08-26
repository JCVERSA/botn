import { BotCommand } from "./types.js";
import pingCommand from "./commands/ping.js";
import menuCommand from "./commands/menu.js";
import aiCommand from "./commands/ai.js";
import imageCommand from "./commands/image.js";
import jokeCommand from "./commands/joke.js";
import quoteCommand from "./commands/quote.js";
import ownerCommand from "./commands/owner.js";
import dareCommand from "./commands/dare.js";
import truthCommand from "./commands/truth.js";
import waifuCommand from "./commands/waifu.js";
import roastCommand from "./commands/roast.js";
import rpsCommand from "./commands/rps.js";
import triviaCommand from "./commands/trivia.js";
import weatherCommand from "./commands/weather.js";
import calcCommand from "./commands/calc.js";
import defineCommand from "./commands/define.js";
import downloadCommand from "./commands/download.js";
import hidetagCommand from "./commands/hidetag.js";
import antilinkCommand from "./commands/antilink.js";
import antitagCommand from "./commands/antitag.js";
import helpCommand from "./commands/help.js";

// Keep a map and list of registered commands
const commandsMap = new Map<string, BotCommand>();

// Set default commands
const defaultCommands = [
  pingCommand,
  menuCommand,
  helpCommand,
  aiCommand,
  imageCommand,
  jokeCommand,
  quoteCommand,
  ownerCommand,
  dareCommand,
  truthCommand,
  waifuCommand,
  roastCommand,
  rpsCommand,
  triviaCommand,
  weatherCommand,
  calcCommand,
  defineCommand,
  downloadCommand,
  hidetagCommand,
  antilinkCommand,
  antitagCommand,
];

// Initialize
export function initRegistry() {
  commandsMap.clear();
  defaultCommands.forEach((cmd) => {
    commandsMap.set(cmd.name.toLowerCase(), cmd);
    if (cmd.aliases && Array.isArray(cmd.aliases)) {
      cmd.aliases.forEach((alias) => {
        commandsMap.set(alias.toLowerCase(), cmd);
      });
    }
  });
  
  // Set in global for access in commands like menu.ts (filter unique to avoid duplicate entries in menu)
  const uniqueCommands = Array.from(new Set(commandsMap.values()));
  (global as any).botCommands = uniqueCommands;
}

export function getCommands(): BotCommand[] {
  return Array.from(commandsMap.values());
}

export function getCommand(name: string): BotCommand | undefined {
  return commandsMap.get(name.toLowerCase());
}

export function registerCommand(cmd: BotCommand) {
  commandsMap.set(cmd.name.toLowerCase(), cmd);
  (global as any).botCommands = Array.from(commandsMap.values());
}

export function removeCommand(name: string) {
  commandsMap.delete(name.toLowerCase());
  (global as any).botCommands = Array.from(commandsMap.values());
}

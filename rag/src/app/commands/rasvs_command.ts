import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Command } from "commander";
import {
  CLI_MESSAGES,
  COMMAND_DEFINITIONS,
  EXIT_COMMANDS,
  HELP_COMMANDS,
  INTERACTIVE_PROMPT,
  PROGRAM_DESCRIPTION,
  PROGRAM_NAME,
  PROGRAM_SUBTITLE,
  PROGRAM_TITLE,
  PROGRAM_VERSION,
  SCREEN_WIDTH,
  type CliCommandDefinition,
} from "./terminal_defaults.js";

export type CommandRunner = () => Promise<void>;
export type CommandRunners = Record<string, CommandRunner>;

interface CliCommand extends CliCommandDefinition {
  run: CommandRunner;
}

export class RasvsCommand {
  private readonly commands: CliCommand[];
  private readonly exitCommands = new Set<string>(EXIT_COMMANDS);
  private readonly helpCommands = new Set<string>(HELP_COMMANDS);

  constructor(runners: CommandRunners) {
    this.commands = COMMAND_DEFINITIONS.map((definition) => {
      const run = runners[definition.name];
      if (!run) {
        throw new Error(`No runner registered for command "${definition.name}".`);
      }
      return { ...definition, run };
    });
  }

  async run(argv: string[] = process.argv): Promise<void> {
    const args = argv.slice(2);

    if (args.length === 0) {
      await this.runInteractivePrompt();
      return;
    }

    await this.buildProgram().parseAsync(argv);
  }

  private padCommand(name: string): string {
    const widest = Math.max(
      ...this.commands.map((command) => command.name.length),
      "help".length,
      "exit".length
    );
    return name.padEnd(widest);
  }

  private printCommandScreen(): void {
    const line = "═".repeat(SCREEN_WIDTH);
    const names = this.commands.map((command) => command.name).join(" | ");

    console.log("");
    console.log(`╔${line}╗`);
    console.log(`║${PROGRAM_TITLE.padStart(40).padEnd(SCREEN_WIDTH)}║`);
    console.log(`║${PROGRAM_SUBTITLE.padStart(57).padEnd(SCREEN_WIDTH)}║`);
    console.log(`╚${line}╝`);
    console.log("");
    console.log(CLI_MESSAGES.availableCommands);
    console.log("");

    for (const command of this.commands) {
      console.log(`    ${this.padCommand(command.name)}  ${command.description}`);
    }

    console.log("");
    console.log(`    ${this.padCommand("help")}  ${CLI_MESSAGES.helpDescription}`);
    console.log(`    ${this.padCommand("exit")}  ${CLI_MESSAGES.exitDescription}`);
    console.log("");
    console.log(`${CLI_MESSAGES.typeACommand} ${names}`);
    console.log("");
  }

  private findCommand(name: string): CliCommand | undefined {
    return this.commands.find((command) => command.name === name);
  }

  private async executeCommand(name: string): Promise<boolean> {
    const normalized = name.trim().toLowerCase();

    if (!normalized) {
      return true;
    }

    if (this.exitCommands.has(normalized)) {
      console.log(CLI_MESSAGES.exiting);
      return false;
    }

    if (this.helpCommands.has(normalized)) {
      this.printCommandScreen();
      return true;
    }

    const command = this.findCommand(normalized);
    if (!command) {
      console.log(CLI_MESSAGES.unknownCommand(name));
      return true;
    }

    await command.run();
    return true;
  }

  private async runInteractivePrompt(): Promise<void> {
    this.printCommandScreen();

    const rl = createInterface({ input, output });

    try {
      let keepRunning = true;
      while (keepRunning) {
        const answer = await rl.question(INTERACTIVE_PROMPT);
        keepRunning = await this.executeCommand(answer);
      }
    } finally {
      rl.close();
    }
  }

  private buildProgram(): Command {
    const program = new Command();

    program
      .name(PROGRAM_NAME)
      .description(PROGRAM_DESCRIPTION)
      .version(PROGRAM_VERSION)
      .showHelpAfterError(CLI_MESSAGES.showHelpAfterError)
      .addHelpText("after", () => {
        const names = this.commands.map(
          (command) => `  ${this.padCommand(command.name)}  ${command.description}`
        );
        return `\n${CLI_MESSAGES.commandsHeading}\n${names.join("\n")}\n\n${CLI_MESSAGES.noArgsHelp}\n`;
      });

    for (const command of this.commands) {
      program
        .command(command.name)
        .description(command.description)
        .action(async () => {
          await command.run();
        });
    }

    return program;
  }
}

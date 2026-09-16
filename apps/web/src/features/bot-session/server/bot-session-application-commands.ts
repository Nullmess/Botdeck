// Méthodes commandes extraites de BotSession.
// Ces fonctions utilisent le contrat interne BotSessionContext pour éviter les contextes non typés.

import type { BotSessionContext } from "./bot-session-context";
import { prisma } from "@/lib/prisma";
import type {
  ApplicationCommandDraft,
  ApplicationCommandRuntimeDefinition,
  ApplicationCommandScope,
  ApplicationCommandSummary,
} from "@botdeck/shared";
import type { Message } from "discord.js";
import { ensureDatabaseReady } from "@/server/database-bootstrap";
import {
  DM_GUILD_ID,
  applicationCommandDraftToPayload,
  fallbackRuntimeForCommand,
  fillRuntimeTemplateForMessage,
  isPrefixCommandDraft,
  isRecord,
  isUnknownApplicationCommandError,
  localPrefixCommandId,
  normalizeApplicationCommand,
  readBotdeckRuntime,
  runtimeMetadata,
  runtimeReplyPayload,
  runtimeResponseMode,
  safeJsonParse,
  storedCommandDefinitionToSummary,
} from "@/server/control-plane-helpers";

export async function loadStoredCommandDefinition(
  this: BotSessionContext,
    commandId: string,
  ): Promise<{
    draft: ApplicationCommandDraft | null;
    runtime: ApplicationCommandRuntimeDefinition | null;
  } | null> {
    const row = await (
      prisma as unknown as {
        applicationCommandDefinition: {
          findUnique: (
            args: unknown,
          ) => Promise<{ draftJson: string; runtimeJson: string } | null>;
        };
      }
    ).applicationCommandDefinition.findUnique({
      where: {
        botAccountId_commandId: { botAccountId: this.account.id, commandId },
      },
    });
    if (!row) return null;
    const draft = safeJsonParse(row.draftJson);
    const runtime = readBotdeckRuntime(safeJsonParse(row.runtimeJson));
    return {
      draft: isRecord(draft)
        ? (draft as unknown as ApplicationCommandDraft)
        : null,
      runtime,
    };
  }

export async function answerPrefixCommand(this: BotSessionContext, message: Message): Promise<void> {
    if (this.account.commandStudioDisabled) return;
    if (message.author.bot || !message.content.trim()) return;
    const rows = await (
      prisma as unknown as {
        applicationCommandDefinition: {
          findMany: (
            args: unknown,
          ) => Promise<
            Array<{
              commandId: string;
              scope: string;
              guildId: string | null;
              draftJson: string;
              runtimeJson: string;
            }>
          >;
        };
      }
    ).applicationCommandDefinition.findMany({
      where: { botAccountId: this.account.id },
    });
    for (const row of rows) {
      const draft = safeJsonParse(row.draftJson);
      const runtime = readBotdeckRuntime(safeJsonParse(row.runtimeJson));
      if (!isRecord(draft) || !runtime) continue;
      const metadata = runtimeMetadata(runtime);
      if (metadata.executionMode !== "prefix") continue;
      const contexts = Array.isArray(draft.contexts)
        ? draft.contexts.filter(
            (item): item is string => typeof item === "string",
          )
        : [];
      const allowsGuild = contexts.length === 0 || contexts.includes("guild");
      const allowsDm =
        contexts.includes("bot_dm") ||
        contexts.includes("private_channel") ||
        draft.dmPermission === true;
      if (message.guildId && !allowsGuild) continue;
      if (!message.guildId && !allowsDm) continue;
      if (
        row.scope === "guild" &&
        row.guildId &&
        row.guildId !== message.guildId
      )
        continue;
      const prefix =
        typeof metadata.prefix === "string" && metadata.prefix
          ? metadata.prefix
          : "&";
      const name = typeof draft.name === "string" ? draft.name : row.commandId;
      const trigger = `${prefix}${name}`;
      if (
        message.content !== trigger &&
        !message.content.startsWith(`${trigger} `)
      )
        continue;
      const args = message.content.slice(trigger.length).trim();
      if (runtimeResponseMode(runtime) === "modal") {
        await message.reply(
          "Cette commande ouvre un modal dans Discord. Utilise la version slash pour afficher le formulaire.",
        );
        return;
      }
      await message.reply(
        runtimeReplyPayload(
          runtime,
          fillRuntimeTemplateForMessage(
            runtime.response.content,
            message,
            name,
            args,
          ),
          row.commandId,
        ),
      );
      return;
    }
  }

export function isSqliteReadonlyError(this: BotSessionContext, error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes("attempt to write a readonly database") ||
      message.includes("SQLITE_READONLY") ||
      message.includes("extended_code: 1032") ||
      message.includes("code: 1032")
    );
  }

export async function logCommandStoreWriteFailure(this: BotSessionContext, error: unknown): Promise<void> {
    const databaseList = await prisma
      .$queryRawUnsafe<
        Array<{ seq: number; name: string; file: string }>
      >("PRAGMA database_list")
      .catch(() => []);
    console.error("[botdeck:db] applicationCommandDefinition.upsert failed", {
      databaseUrl: process.env.DATABASE_URL,
      databaseSource: process.env.BOTDECK_DATABASE_SOURCE,
      databasePath: process.env.BOTDECK_DATABASE_PATH_RESOLVED,
      databaseList,
      error,
    });
  }

export async function persistCommandDefinition(
  this: BotSessionContext,
    commandId: string,
    draft: ApplicationCommandDraft,
    summary: ApplicationCommandSummary,
  ): Promise<ApplicationCommandSummary> {
    await ensureDatabaseReady();
    const runtime =
      readBotdeckRuntime(draft.runtime) ??
      fallbackRuntimeForCommand(summary.name);
    const fullDraft: ApplicationCommandDraft = {
      ...draft,
      id: commandId,
      runtime,
    };
    const returnedSummary = {
      ...summary,
      runtime,
      raw: { ...summary.raw, botdeckRuntime: runtime, botdeckDraft: fullDraft },
    };
    const upsertCommandDefinition = async () => {
      await (
        prisma as unknown as {
          applicationCommandDefinition: {
            upsert: (args: unknown) => Promise<unknown>;
          };
        }
      ).applicationCommandDefinition.upsert({
        where: {
          botAccountId_commandId: { botAccountId: this.account.id, commandId },
        },
        update: {
          scope: summary.scope,
          guildId: summary.guildId ?? null,
          name: summary.name,
          draftJson: JSON.stringify(fullDraft),
          runtimeJson: JSON.stringify(runtime),
        },
        create: {
          botAccountId: this.account.id,
          commandId,
          scope: summary.scope,
          guildId: summary.guildId ?? null,
          name: summary.name,
          draftJson: JSON.stringify(fullDraft),
          runtimeJson: JSON.stringify(runtime),
        },
      });
    };

    try {
      await upsertCommandDefinition();
    } catch (error) {
      await this.logCommandStoreWriteFailure(error);
      if (!this.isSqliteReadonlyError(error)) throw error;

      // Mémoire commandes: tentative sûre.
      // Discord déjà validé; HMR peut casser SQLite.
      console.warn(
        "[botdeck:db] Command metadata cache write failed with SQLite readonly. The app will continue without crashing.",
      );
      await prisma.$disconnect().catch(() => undefined);
      try {
        await upsertCommandDefinition();
      } catch (retryError) {
        await this.logCommandStoreWriteFailure(retryError);
        console.warn(
          "[botdeck:db] Command metadata was not persisted after retry; returning the live Discord command response.",
        );
        return returnedSummary;
      }
    }
    return returnedSummary;
  }

export async function persistLocalPrefixCommandDefinition(
  this: BotSessionContext,
    draft: ApplicationCommandDraft,
    commandId?: string | null,
  ): Promise<ApplicationCommandSummary> {
    await ensureDatabaseReady();
    const runtime =
      readBotdeckRuntime(draft.runtime) ??
      fallbackRuntimeForCommand(draft.name);
    const scope = draft.scope === "guild" ? "guild" : "global";
    const guildId = scope === "guild" ? (draft.guildId ?? null) : null;
    const localId =
      commandId && commandId.startsWith("local-prefix:")
        ? commandId
        : localPrefixCommandId(scope, guildId, draft.name);
    const fullDraft: ApplicationCommandDraft = {
      ...draft,
      id: localId,
      scope,
      guildId,
      runtime,
    };
    await (
      prisma as unknown as {
        applicationCommandDefinition: {
          upsert: (args: unknown) => Promise<unknown>;
        };
      }
    ).applicationCommandDefinition.upsert({
      where: {
        botAccountId_commandId: {
          botAccountId: this.account.id,
          commandId: localId,
        },
      },
      update: {
        scope,
        guildId,
        name: draft.name.trim(),
        draftJson: JSON.stringify(fullDraft),
        runtimeJson: JSON.stringify(runtime),
      },
      create: {
        botAccountId: this.account.id,
        commandId: localId,
        scope,
        guildId,
        name: draft.name.trim(),
        draftJson: JSON.stringify(fullDraft),
        runtimeJson: JSON.stringify(runtime),
      },
    });
    const row = {
      commandId: localId,
      scope,
      guildId,
      name: draft.name.trim(),
      draftJson: JSON.stringify(fullDraft),
      runtimeJson: JSON.stringify(runtime),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const summary = storedCommandDefinitionToSummary(row);
    if (!summary) throw new Error("Failed to store prefix command.");
    return summary;
  }

export async function ensureCommandStoreWritable(this: BotSessionContext): Promise<void> {
    const rollbackMarker = new Error("botdeck-command-store-write-check");
    try {
      await prisma.$transaction(async (transaction: any) => {
        await (
          transaction as unknown as {
            applicationCommandDefinition: {
              create: (args: unknown) => Promise<unknown>;
            };
          }
        ).applicationCommandDefinition.create({
          data: {
            botAccountId: this.account.id,
            commandId: `__botdeck_write_check_${Date.now()}`,
            scope: "preflight",
            guildId: null,
            name: "preflight",
            draftJson: "{}",
            runtimeJson: "{}",
          },
        });
        throw rollbackMarker;
      });
    } catch (error) {
      if (error === rollbackMarker) return;
      await this.logCommandStoreWriteFailure(error);
      if (this.isSqliteReadonlyError(error)) {
        console.warn(
          "[botdeck:db] Command metadata store is readonly right now; continuing because Discord command creation can still succeed.",
        );
        return;
      }
      throw error;
    }
  }

export async function hydrateCommandDefinitions(
  this: BotSessionContext,
    commands: ApplicationCommandSummary[],
  ): Promise<ApplicationCommandSummary[]> {
    return Promise.all(
      commands.map(async (command) => {
        const stored = await this.loadStoredCommandDefinition(command.id);
        if (!stored?.runtime && !stored?.draft) return command;
        return {
          ...command,
          runtime: stored.runtime ?? command.runtime ?? null,
          raw: {
            ...command.raw,
            botdeckRuntime: stored.runtime ?? command.runtime ?? null,
            botdeckDraft: stored.draft ?? null,
          },
        };
      }),
    );
  }

export function assertCommandStudioEnabled(this: BotSessionContext): void {
    if (this.account.commandStudioDisabled) {
      throw new Error(
        "Mode lecture seule actif : Botdeck ne gère pas les /commandes de ce bot.",
      );
    }
  }

export async function fetchApplicationCommands(
  this: BotSessionContext,
    guildId?: string | null,
    allGuilds = false,
  ): Promise<{
    globalCommands: ApplicationCommandSummary[];
    guildCommands: ApplicationCommandSummary[];
    partialError?: string | null;
  }> {
    this.assertCommandStudioEnabled();
    if (!this.client.application) {
      throw new Error("Discord application is not ready yet.");
    }

    const globalCollection = await this.client.application.commands.fetch();
    const globalCommands = await this.hydrateCommandDefinitions(
      [...globalCollection.values()]
        .map((command) => normalizeApplicationCommand(command, "global"))
        .sort((left, right) => left.name.localeCompare(right.name)),
    );

    let guildCommands: ApplicationCommandSummary[] = [];
    let partialError: string | null = null;

    if (allGuilds) {
      const guilds = [...this.client.guilds.cache.values()].sort(
        (left, right) => left.name.localeCompare(right.name),
      );
      const errors: string[] = [];
      for (const cachedGuild of guilds) {
        try {
          const guild = await this.client.guilds.fetch(cachedGuild.id);
          const guildCollection = await guild.commands.fetch();
          guildCommands.push(
            ...(await this.hydrateCommandDefinitions(
              [...guildCollection.values()].map((command) =>
                normalizeApplicationCommand(command, "guild", guild.id),
              ),
            )),
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to load guild commands.";
          errors.push(`${cachedGuild.name}: ${message}`);
          this.publishEvent({
            type: "audit.log",
            level: "warn",
            message: "Failed to load guild application commands.",
            context: {
              botId: this.account.id,
              guildId: cachedGuild.id,
              error: message,
            },
          });
        }
      }
      guildCommands = guildCommands.sort((left, right) =>
        `${left.guildId ?? ""}:${left.name}`.localeCompare(
          `${right.guildId ?? ""}:${right.name}`,
        ),
      );
      partialError = errors.length ? errors.slice(0, 3).join(" · ") : null;
    } else if (guildId && guildId !== DM_GUILD_ID) {
      if (!/^\d{17,20}$/.test(guildId)) {
        partialError = "Invalid server id for application commands.";
      } else
        try {
          const guild = await this.client.guilds.fetch(guildId);
          const guildCollection = await guild.commands.fetch();
          guildCommands = await this.hydrateCommandDefinitions(
            [...guildCollection.values()]
              .map((command) =>
                normalizeApplicationCommand(command, "guild", guild.id),
              )
              .sort((left, right) => left.name.localeCompare(right.name)),
          );
        } catch (error) {
          partialError =
            error instanceof Error
              ? error.message
              : "Failed to load guild commands.";
          this.publishEvent({
            type: "audit.log",
            level: "warn",
            message: "Failed to load guild application commands.",
            context: { botId: this.account.id, guildId, error: partialError },
          });
        }
    }

    const localRows = await (
      prisma as unknown as {
        applicationCommandDefinition: {
          findMany: (
            args: unknown,
          ) => Promise<
            Array<{
              commandId: string;
              scope: string;
              guildId: string | null;
              name: string;
              draftJson: string;
              runtimeJson: string;
              createdAt: Date;
              updatedAt: Date;
            }>
          >;
        };
      }
    ).applicationCommandDefinition
      .findMany({
        where: {
          botAccountId: this.account.id,
          OR: [
            { commandId: { startsWith: "local-prefix:" } },
            { scope: "prefix" },
          ],
        },
      })
      .catch(() => []);
    const localPrefixCommands = localRows
      .map(storedCommandDefinitionToSummary)
      .filter((command): command is ApplicationCommandSummary =>
        Boolean(command),
      );
    const mergeCommands = (
      liveCommands: ApplicationCommandSummary[],
      prefixCommands: ApplicationCommandSummary[],
    ) => {
      const liveIds = new Set(liveCommands.map((command) => command.id));
      return [
        ...liveCommands,
        ...prefixCommands.filter((command) => !liveIds.has(command.id)),
      ].sort((left, right) => left.name.localeCompare(right.name));
    };

    return {
      globalCommands: mergeCommands(
        globalCommands,
        localPrefixCommands.filter((command) => command.scope === "global"),
      ),
      guildCommands: mergeCommands(
        guildCommands,
        localPrefixCommands.filter(
          (command) =>
            command.scope === "guild" &&
            (allGuilds || !guildId || command.guildId === guildId),
        ),
      ),
      partialError,
    };
  }

export async function createApplicationCommand(
  this: BotSessionContext,
    draft: ApplicationCommandDraft,
  ): Promise<ApplicationCommandSummary> {
    this.assertCommandStudioEnabled();
    if (isPrefixCommandDraft(draft)) {
      return this.persistLocalPrefixCommandDefinition(draft);
    }
    if (!this.client.application) {
      throw new Error("Discord application is not ready yet.");
    }

    await this.ensureCommandStoreWritable();
    const payload = applicationCommandDraftToPayload(draft);

    if (draft.scope === "guild") {
      if (
        !draft.guildId ||
        draft.guildId === DM_GUILD_ID ||
        draft.guildId === "__all__" ||
        !/^\d{17,20}$/.test(draft.guildId)
      ) {
        throw new Error("A server command needs a valid server id.");
      }

      const guild = await this.client.guilds.fetch(draft.guildId);
      const command = await guild.commands.create(
        payload as unknown as Parameters<typeof guild.commands.create>[0],
      );
      return this.persistCommandDefinition(
        command.id,
        draft,
        normalizeApplicationCommand(command, "guild", guild.id),
      );
    }

    const command = await this.client.application.commands.create(
      payload as unknown as Parameters<
        typeof this.client.application.commands.create
      >[0],
    );
    return this.persistCommandDefinition(
      command.id,
      draft,
      normalizeApplicationCommand(command, "global", null),
    );
  }

export async function updateApplicationCommand(
  this: BotSessionContext,
    commandId: string,
    draft: ApplicationCommandDraft,
  ): Promise<ApplicationCommandSummary> {
    this.assertCommandStudioEnabled();
    if (isPrefixCommandDraft(draft)) {
      if (!commandId.startsWith("local-prefix:") && this.client.application) {
        await (
          prisma as unknown as {
            applicationCommandDefinition: {
              deleteMany: (args: unknown) => Promise<unknown>;
            };
          }
        ).applicationCommandDefinition
          .deleteMany({ where: { botAccountId: this.account.id, commandId } })
          .catch(() => undefined);
        if (
          draft.scope === "guild" &&
          draft.guildId &&
          draft.guildId !== DM_GUILD_ID
        ) {
          const guild = await this.client.guilds
            .fetch(draft.guildId)
            .catch(() => null);
          await guild?.commands.delete(commandId).catch(() => undefined);
        } else {
          await this.client.application.commands
            .delete(commandId)
            .catch(() => undefined);
        }
      }
      return this.persistLocalPrefixCommandDefinition(draft, commandId);
    }
    if (!this.client.application) {
      throw new Error("Discord application is not ready yet.");
    }

    await this.ensureCommandStoreWritable();
    const payload = applicationCommandDraftToPayload(draft);

    if (draft.scope === "guild") {
      if (
        !draft.guildId ||
        draft.guildId === DM_GUILD_ID ||
        draft.guildId === "__all__" ||
        !/^\d{17,20}$/.test(draft.guildId)
      ) {
        throw new Error("A server command needs a valid server id.");
      }

      const guild = await this.client.guilds.fetch(draft.guildId);

      try {
        const command = await guild.commands.edit(
          commandId,
          payload as unknown as Parameters<typeof guild.commands.edit>[1],
        );
        return this.persistCommandDefinition(
          command.id,
          draft,
          normalizeApplicationCommand(command, "guild", guild.id),
        );
      } catch (error) {
        if (!isUnknownApplicationCommandError(error)) throw error;

        await (
          prisma as unknown as {
            applicationCommandDefinition: {
              deleteMany: (args: unknown) => Promise<unknown>;
            };
          }
        ).applicationCommandDefinition
          .deleteMany({
            where: { botAccountId: this.account.id, commandId },
          })
          .catch(() => undefined);

        const existingCommands = await guild.commands.fetch();
        const existing = [...existingCommands.values()].find(
          (candidate) => candidate.name === draft.name,
        );

        if (existing) {
          const command = await guild.commands.edit(
            existing.id,
            payload as unknown as Parameters<typeof guild.commands.edit>[1],
          );
          return this.persistCommandDefinition(
            command.id,
            draft,
            normalizeApplicationCommand(command, "guild", guild.id),
          );
        }

        const command = await guild.commands.create(
          payload as unknown as Parameters<typeof guild.commands.create>[0],
        );
        return this.persistCommandDefinition(
          command.id,
          draft,
          normalizeApplicationCommand(command, "guild", guild.id),
        );
      }
    }

    try {
      const command = await this.client.application.commands.edit(
        commandId,
        payload as unknown as Parameters<
          typeof this.client.application.commands.edit
        >[1],
      );
      return this.persistCommandDefinition(
        command.id,
        draft,
        normalizeApplicationCommand(command, "global"),
      );
    } catch (error) {
      if (!isUnknownApplicationCommandError(error)) throw error;

      await (
        prisma as unknown as {
          applicationCommandDefinition: {
            deleteMany: (args: unknown) => Promise<unknown>;
          };
        }
      ).applicationCommandDefinition
        .deleteMany({
          where: { botAccountId: this.account.id, commandId },
        })
        .catch(() => undefined);

      const existingCommands = await this.client.application.commands.fetch();
      const existing = [...existingCommands.values()].find(
        (candidate) => candidate.name === draft.name,
      );

      if (existing) {
        const command = await this.client.application.commands.edit(
          existing.id,
          payload as unknown as Parameters<
            typeof this.client.application.commands.edit
          >[1],
        );
        return this.persistCommandDefinition(
          command.id,
          draft,
          normalizeApplicationCommand(command, "global"),
        );
      }

      const command = await this.client.application.commands.create(
        payload as unknown as Parameters<
          typeof this.client.application.commands.create
        >[0],
      );
      return this.persistCommandDefinition(
        command.id,
        draft,
        normalizeApplicationCommand(command, "global"),
      );
    }
  }

export async function deleteApplicationCommand(
  this: BotSessionContext,
    commandId: string,
    scope: ApplicationCommandScope,
    guildId?: string | null,
  ): Promise<void> {
    this.assertCommandStudioEnabled();
    await (
      prisma as unknown as {
        applicationCommandDefinition: {
          delete: (args: unknown) => Promise<unknown>;
        };
      }
    ).applicationCommandDefinition
      .delete({
        where: {
          botAccountId_commandId: { botAccountId: this.account.id, commandId },
        },
      })
      .catch(() => undefined);
    if (commandId.startsWith("local-prefix:")) return;
    if (!this.client.application) {
      throw new Error("Discord application is not ready yet.");
    }

    if (scope === "guild") {
      if (
        !guildId ||
        guildId === DM_GUILD_ID ||
        guildId === "__all__" ||
        !/^\d{17,20}$/.test(guildId)
      ) {
        throw new Error("A server command needs a valid server id.");
      }
      const guild = await this.client.guilds.fetch(guildId);
      await guild.commands.delete(commandId);
      return;
    }

    await this.client.application.commands.delete(commandId);
  }

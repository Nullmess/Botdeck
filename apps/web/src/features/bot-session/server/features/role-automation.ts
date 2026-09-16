import type { GuildRoleAutomationConditionMode } from "@botdeck/shared";

export type StoredRoleAutomationRule = {
  id: string;
  guildId: string;
  roleId: string;
  enabled: boolean;
  conditionMode: string;
  minMessages: number | null;
  minVoiceSeconds: number | null;
  minMemberAgeSeconds: number | null;
  removeWhenInvalid: boolean;
  ignoreBots: boolean;
  applyToExistingMembers: boolean;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type StoredMemberActivity = {
  guildId: string;
  userId: string;
  messageCount: number;
  voiceSeconds: number;
  joinedAt: Date | string | null;
};

export type RoleAutomationRuleInput = {
  ruleId?: string | null;
  roleId: string;
  enabled: boolean;
  conditionMode: GuildRoleAutomationConditionMode;
  minMessages?: number | null;
  minVoiceSeconds?: number | null;
  minMemberAgeSeconds?: number | null;
  removeWhenInvalid: boolean;
  ignoreBots: boolean;
  applyToExistingMembers: boolean;
};

export const ROLE_AUTOMATION_MAX_MESSAGES = 1000000;
export const ROLE_AUTOMATION_MAX_VOICE_SECONDS = 1000000 * 60;
export const ROLE_AUTOMATION_MAX_MEMBER_AGE_SECONDS = 20000 * 86400;
export const ROLE_AUTOMATION_DISCORD_TIMEOUT_MS = 8000;

export async function withRoleAutomationTimeout<T>(
  task: Promise<T>,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `${label} timed out. Check the bot connection and Discord permissions.`,
              ),
            ),
          ROLE_AUTOMATION_DISCORD_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

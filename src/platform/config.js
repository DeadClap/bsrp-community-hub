function readBoolean(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function readList(value, fallback = []) {
  if (!value) {
    return fallback;
  }

  return String(value)
    .split(/[ ,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getConfig(env = process.env) {
  return {
    port: Number(env.PORT ?? 3000),
    storageDriver: env.STORAGE_DRIVER ?? "memory",
    databaseUrl: env.DATABASE_URL ?? "",
    seedOnBoot: readBoolean(env.SEED_ON_BOOT, true),
    discord: {
      oauthEnabled: readBoolean(env.DISCORD_OAUTH_ENABLED, false),
      clientId: env.DISCORD_CLIENT_ID ?? "",
      clientSecret: env.DISCORD_CLIENT_SECRET ?? "",
      redirectUri: env.DISCORD_REDIRECT_URI ?? "",
      guildId: env.DISCORD_GUILD_ID ?? "",
      botToken: env.DISCORD_BOT_TOKEN ?? "",
      scopes: readList(env.DISCORD_OAUTH_SCOPES, ["identify", "guilds", "guilds.members.read"]),
    },
  };
}

export function validateConfig(config) {
  if (config.storageDriver === "postgres" && !config.databaseUrl) {
    throw new Error("DATABASE_URL is required when STORAGE_DRIVER=postgres");
  }

  if (!config.discord.oauthEnabled) {
    return config;
  }

  const requiredDiscordFields = [
    ["DISCORD_CLIENT_ID", config.discord.clientId],
    ["DISCORD_CLIENT_SECRET", config.discord.clientSecret],
    ["DISCORD_REDIRECT_URI", config.discord.redirectUri],
    ["DISCORD_GUILD_ID", config.discord.guildId],
    ["DISCORD_BOT_TOKEN", config.discord.botToken],
  ];

  const missingFields = requiredDiscordFields
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingFields.length > 0) {
    throw new Error(`Discord OAuth is enabled but missing: ${missingFields.join(", ")}`);
  }

  return config;
}

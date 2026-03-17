import { AppError } from "../shared/errors.js";

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";

async function parseJsonResponse(response, defaultMessage) {
  const payload = await response.json();

  if (!response.ok) {
    throw new AppError(response.status, payload.error_description ?? payload.message ?? defaultMessage, payload);
  }

  return payload;
}

export class DiscordOAuthService {
  constructor({ config, fetchImpl }) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  createAuthorizationUrl(state) {
    const url = new URL(`${DISCORD_API_BASE_URL}/oauth2/authorize`);
    url.searchParams.set("client_id", this.config.discord.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", this.config.discord.redirectUri);
    url.searchParams.set("scope", this.config.discord.scopes.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "consent");
    return url.toString();
  }

  async exchangeCodeForAccessToken(code) {
    const response = await this.fetchImpl(`${DISCORD_API_BASE_URL}/oauth2/token`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.config.discord.clientId,
        client_secret: this.config.discord.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.discord.redirectUri,
      }).toString(),
    });

    return parseJsonResponse(response, "Failed to exchange Discord OAuth code");
  }

  async fetchCurrentUser(accessToken) {
    const response = await this.fetchImpl(`${DISCORD_API_BASE_URL}/users/@me`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    return parseJsonResponse(response, "Failed to fetch Discord user");
  }

  async fetchGuildMember(userId) {
    const response = await this.fetchImpl(
      `${DISCORD_API_BASE_URL}/guilds/${this.config.discord.guildId}/members/${userId}`,
      {
        headers: {
          authorization: `Bot ${this.config.discord.botToken}`,
        },
      },
    );

    return parseJsonResponse(response, "Failed to fetch Discord guild member");
  }
}

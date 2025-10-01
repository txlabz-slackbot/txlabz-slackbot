import { WebClient, ErrorCode } from "@slack/web-api";

const token = process.env.SLACK_BOT_TOKEN;
export const slack = new WebClient(token);

export async function listChannels() {
  if (!token) {
    throw new Error("SLACK_BOT_TOKEN is missing. Set it in .env.local and restart the server.");
  }
  const channels = [];
  let cursor = undefined;
  do {
    const res = await slack.conversations.list({
      limit: 200,
      cursor,
      types: "public_channel,private_channel",
      exclude_archived: true,
    });
    if (res?.channels) channels.push(...res.channels);
    cursor = res.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return channels;
}

export async function postMessageWithRetry({ channel, text }, maxRetries = 3) {
  let attempt = 0;
  let delayMs = 500;
  
  const blocks = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": text,
      }
    }
  ];

  while (attempt <= maxRetries) {
    try {
      return await slack.chat.postMessage({ 
          channel, 
          blocks, 
          // Use the original markdown text as the fallback for notifications.
          // Slack will automatically create a clean, plain-text version.
          text: text 
      });
    } catch (err) {
      const isRateLimit = err?.code === ErrorCode.RateLimitedError || err?.data?.retry_after;
      if (attempt === maxRetries || (!isRateLimit && attempt >= 1)) throw err;
      const retryAfter = Number(err?.data?.headers?.["retry-after"]) || delayMs;
      await new Promise((r) => setTimeout(r, retryAfter * 1000 || delayMs));
      delayMs *= 2;
      attempt += 1;
    }
  }
}


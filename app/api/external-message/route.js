import { NextResponse } from "next/server";
import { getChannelInfo, postMessageWithRetry } from "../../../lib/slack";

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.EXTERNAL_API_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      requestTime,
      requestType,
      subject,
      message,
      requestBy,
      "HR Records/Recommendation": hrRecords,
      channelId 
    } = body;

    if (!channelId) {
      return NextResponse.json({ error: "The 'channelId' field is required." }, { status: 400 });
    }

    // Use the correct function to get channel info by ID
    const channel = await getChannelInfo(channelId);
    if (!channel) {
      return NextResponse.json({ error: `Channel with ID "${channelId}" not found.` }, { status: 404 });
    }

    const blocks = [];
    const fields = [];

    // Build the fields array first
    if (requestTime) fields.push({ type: "mrkdwn", text: `*Request Time:*\n${requestTime}` });
    if (requestType) fields.push({ type: "mrkdwn", text: `*Request Type:*\n${requestType}` });
    if (requestBy) fields.push({ type: "mrkdwn", text: `*Requested By:*\n${requestBy}` });
    if (hrRecords) fields.push({ type: "mrkdwn", text: `*HR Records/Recommendation:*\n${hrRecords}` });

    if (fields.length > 0) {
      blocks.push({
        type: "section",
        fields: fields
      });
    }

    if (blocks.length > 0 && (subject || message)) {
        blocks.push({ type: "divider" });
    }

    if (subject) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Subject:*\n${subject}`
        }
      });
    }

    if (message) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: message
        }
      });
    }
    
    if (blocks.length === 0) {
      return NextResponse.json({ error: "No message content provided." }, { status: 400 });
    }

    await postMessageWithRetry({
      channel: channel.id,
      text: `New message received: ${subject || message.substring(0, 50)}`,
      blocks: blocks
    });
    
    return NextResponse.json({ ok: true, message: "Message sent successfully." });

  } catch (e) {
    console.error("External message API failed:", e);
    if (e instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
    }
    return new Response(`External message API failed: ${e.message}`, { status: 500 });
  }
}


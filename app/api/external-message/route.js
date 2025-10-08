import { NextResponse } from "next/server";
import { findChannelByName, postMessageWithRetry } from "../../../lib/slack";

export async function POST(request) {
  // 1. Secure the endpoint with a secret token
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.EXTERNAL_API_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 2. Parse the incoming JSON body
    const body = await request.json();
    const {
      requestTime,
      requestType,
      message,
      requestBy,
      "HR Records/Recommendation": hrRecords, // Handles the key with spaces
      channelName
    } = body;

    // 3. Validate that a channel name was provided
    if (!channelName) {
      return NextResponse.json({ error: "The 'channelName' field is required." }, { status: 400 });
    }

    // 4. Find the channel's ID using its name
    const channel = await findChannelByName(channelName);
    if (!channel) {
      return NextResponse.json({ error: `Channel "${channelName}" not found.` }, { status: 404 });
    }

    // 5. Format the data into a Slack message using Block Kit
    const blocks = [];

    // Add the main message if it exists
    if (message) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: message
        }
      });
    }

    // Create a section with two columns for the metadata fields
    const fields = [];
    if (requestType) {
      fields.push({ type: "mrkdwn", text: `*Request Type:*\n${requestType}` });
    }
    if (requestBy) {
      fields.push({ type: "mrkdwn", text: `*Requested By:*\n${requestBy}` });
    }
    if (hrRecords) {
      fields.push({ type: "mrkdwn", text: `*HR Records/Recommendation:*\n${hrRecords}` });
    }
    if (requestTime) {
      fields.push({ type: "mrkdwn", text: `*Request Time:*\n${requestTime}` });
    }

    // Add the fields section if any fields were provided
    if (fields.length > 0) {
      if (blocks.length > 0) {
        blocks.push({ type: "divider" });
      }
      blocks.push({
        type: "section",
        fields: fields
      });
    }
    
    // Ensure there's content to send
    if (blocks.length === 0) {
      return NextResponse.json({ error: "No message content provided." }, { status: 400 });
    }

    // 6. Post the formatted message to the found channel
    await postMessageWithRetry({
      channel: channel.id,
      text: `New message received for ${channelName}`, // Fallback text for notifications
      blocks: blocks
    });
    
    // 7. Return a success response
    return NextResponse.json({ ok: true, message: "Message sent successfully." });

  } catch (e) {
    console.error("External message API failed:", e);
    if (e instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
    }
    return new Response(`External message API failed: ${e.message}`, { status: 500 });
  }
}

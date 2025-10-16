import { NextResponse } from "next/server";
import { postMessageWithRetry } from "../../../lib/slack";

export async function POST(request) {
  console.log("1. Received a request to /api/external-message");

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.EXTERNAL_API_SECRET}`) {
    console.error("2. Authorization failed: Incorrect or missing secret.");
    return new Response('Unauthorized', { status: 401 });
  }
  console.log("2. Authorization successful.");

  try {
    const body = await request.json();
    console.log("3. Successfully parsed request body:", body);

    const { subjectType } = body;

    if (!subjectType) {
      console.error("4. Validation failed: 'subjectType' is missing.");
      return NextResponse.json({ error: "The 'subjectType' field is required (e.g., 'hr', 'tech')." }, { status: 400 });
    }

    let channelId;
    switch (subjectType.toLowerCase()) {
      case 'hr':
        channelId = process.env.SLACK_HR_CHANNEL_ID;
        break;
      case 'tech':
        channelId = process.env.SLACK_TECH_CHANNEL_ID;
        break;
      default:
        channelId = process.env.SLACK_GENERAL_CHANNEL_ID;
        break;
    }
    console.log(`4. Determined channel ID for subjectType '${subjectType}': ${channelId}`);

    if (!channelId) {
      console.error("5. Routing failed: No channel ID configured for this subjectType.");
      return NextResponse.json({ error: `No channel ID is configured for subjectType: '${subjectType}'.` }, { status: 500 });
    }

    // (Code to build message blocks remains the same)
    const { requestTime, requestType, subject, message, requestBy, "HR Records/Recommendation": hrRecords } = body;
    const blocks = [];
    let headerText = "";
    if (requestTime) headerText += `*Request Time:* ${requestTime}\n`;
    if (requestType) headerText += `*Request Type:* ${requestType}\n`;
    if (headerText) { blocks.push({ type: "section", text: { type: "mrkdwn", text: headerText } }); }
    let mainMessage = "";
    if (subject) mainMessage += `*Subject: ${subject}*\n`;
    if (message) mainMessage += message;
    if (mainMessage) { blocks.push({ type: "section", text: { type: "mrkdwn", text: mainMessage } }); }
    const footerFields = [];
    if (requestBy) footerFields.push({ type: "mrkdwn", text: `*Requested By:*\n${requestBy}` });
    if (hrRecords) footerFields.push({ type: "mrkdwn", text: `*HR Records/Recommendation:*\n${hrRecords}` });
    if (footerFields.length > 0) { if (blocks.length > 0) blocks.push({ type: "divider" }); blocks.push({ type: "section", fields: footerFields }); }
    
    if (blocks.length === 0) {
      return NextResponse.json({ error: "No message content was provided." }, { status: 400 });
    }

    console.log("5. About to send message to Slack...");
    await postMessageWithRetry({
      channel: channelId,
      text: subject || `New message for ${subjectType}`,
      blocks: blocks
    });
    console.log("6. Successfully sent message to Slack.");
    
    return NextResponse.json({ ok: true, message: `Message successfully routed to the ${subjectType} channel.` });

  } catch (e) {
    console.error("7. An error occurred in the API route:", e);
    if (e instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
    }
    return new Response(`External message API failed: ${e.message}`, { status: 500 });
  }
}


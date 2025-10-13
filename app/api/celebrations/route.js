import { NextResponse } from "next/server";
import { getUsers, getTeamProfile, findChannelByName, postMessageWithRetry, slack } from "../../../lib/slack"; // Import slack client

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const users = await getUsers();
    const profileFields = await getTeamProfile();

    const birthdayField = profileFields.find(f => f.label === "Birthday");
    const startDateField = profileFields.find(f => f.label === "Start date");

    if (!startDateField) {
      return new Response("'Start date' custom field not found.", { status: 500 });
    }
    
    const today = new Date();
    today.setUTCHours(today.getUTCHours() + 5);
    const todayMonth = today.getUTCMonth() + 1;
    const todayDate = today.getUTCDate();
    const todayYear = today.getUTCFullYear();

    const generalChannel = await findChannelByName("general");
    if (!generalChannel) {
      return new Response("'general' channel not found.", { status: 500 });
    }

    const messagesToSend = [];

    for (const user of users) {
      if (user.is_bot || user.deleted) continue;

      // **FIX: Fetch the full profile for each user individually**
      const profileRes = await slack.users.profile.get({ user: user.id });
      const userProfileFields = profileRes.profile.fields;

      if (!userProfileFields) continue;

      // Check for birthday
      if (birthdayField) {
        const birthday = userProfileFields[birthdayField.id]?.value;
        if (birthday) {
          const [birthYear, birthMonth, birthDate] = birthday.split('-').map(Number);
          if (birthMonth === todayMonth && birthDate === todayDate) {
            messagesToSend.push({
              channel: generalChannel.id,
              text: `Happy Birthday <@${user.id}>! Wishing you a fantastic day! 🎉🎂`,
            });
          }
        }
      }

      // Check for work anniversary
      const hireDateStr = userProfileFields[startDateField.id]?.value;
      if (hireDateStr) {
        const [hireYear, hireMonth, hireDate] = hireDateStr.split('-').map(Number);
        
        if (hireMonth === todayMonth && hireDate === todayDate && hireYear < todayYear) {
          const yearsOfService = todayYear - hireYear;
          let suffix = "th";
          if (yearsOfService % 10 === 1 && yearsOfService % 100 !== 11) suffix = "st";
          else if (yearsOfService % 10 === 2 && yearsOfService % 100 !== 12) suffix = "nd";
          else if (yearsOfService % 10 === 3 && yearsOfService % 100 !== 13) suffix = "rd";

          messagesToSend.push({
            channel: generalChannel.id,
            text: `Happy ${yearsOfService}${suffix} Work Anniversary, <@${user.id}>! Thank you for being a great part of the team! 🥳`,
          });
        }
      }
    }

    for (const message of messagesToSend) {
      await postMessageWithRetry(message);
    }

    return NextResponse.json({ ok: true, messagesSent: messagesToSend.length });
  } catch (e) {
    console.error("Celebrations cron job failed:", e);
    return new Response("Celebrations cron job failed", { status: 500 });
  }
}
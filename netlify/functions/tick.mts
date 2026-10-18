// Runs the reminder scheduler once a minute on Netlify, where no server process stays up to
// run it. The work happens in the app (/api/cron/tick); this only knocks on the door.
// Netlify runs scheduled functions on published production deploys only.

export default async () => {
  const res = await fetch(`${process.env.URL}/api/cron/tick`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  if (!res.ok) console.error(`[tick] ${res.status} ${await res.text()}`);
};

export const config = { schedule: "* * * * *" };

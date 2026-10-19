// node:net and node:dns in the demo worker (webhook URL checks; webhooks never send here).
export const isIP = (s: string) => (/^\d{1,3}(\.\d{1,3}){3}$/.test(s) ? 4 : s.includes(":") ? 6 : 0);
export const lookup = async () => [{ address: "93.184.216.34", family: 4 }];
export default { isIP, lookup };

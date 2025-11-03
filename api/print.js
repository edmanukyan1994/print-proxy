import iconv from "iconv-lite";
import net from "net";

const PRINTERS = {
  bar:     { host: "a36a0b0a09e1.sn.mynetname.net", port: 39100 },
  mangal:  { host: "a36a0b0a09e1.sn.mynetname.net", port: 39101 },
  kitchen: { host: "a36a0b0a09e1.sn.mynetname.net", port: 39102 },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const API_KEY = process.env.PRINT_API_KEY || "";
  if (API_KEY && req.headers.authorization !== `Bearer ${API_KEY}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { printerKey, data, cut = true } = req.body || {};
  const target = PRINTERS[printerKey];
  if (!target || typeof data !== "string") return res.status(400).json({ error: "Bad payload" });

  const escHeader = Buffer.from([0x1B,0x40, 0x1B,0x74,0x11]);
  const escCut    = Buffer.from([0x1D,0x56,0x41,0x10]);
  const body = iconv.encode(data.replace(/\n/g, "\r\n"), "cp866");
  const payload = cut
    ? Buffer.concat([escHeader, body, Buffer.from("\r\n\r\n"), escCut])
    : Buffer.concat([escHeader, body, Buffer.from("\r\n\r\n")]);

  try {
    await new Promise((resolve, reject) => {
      const sock = new net.Socket();
      sock.setTimeout(7000);
      sock.connect(target.port, target.host, () => {
        sock.write(payload);
        sock.end();
      });
      sock.on("close", resolve);
      sock.on("error", reject);
      sock.on("timeout", () => reject(new Error("timeout")));
    });
    res.status(200).json({ ok: true });
  } catch {
    res.status(502).json({ error: "Printer connection failed" });
  }
}

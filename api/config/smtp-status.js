import { getSmtpConfig, applyCors } from "../lib/db.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido. Utilize GET." });
  }

  try {
    const config = await getSmtpConfig();
    if (!config) {
      return res.status(200).json({ configured: false });
    }

    const { senha, ...safeConfig } = config;
    return res.status(200).json({
      configured: config.configured,
      ...safeConfig,
      maskedPassword: senha ? "********" : ""
    });
  } catch (err) {
    console.error("Erro ao buscar status SMTP em serverless:", err);
    return res.status(500).json({ error: "Erro ao buscar status do servidor SMTP." });
  }
}

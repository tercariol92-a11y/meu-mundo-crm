import { getGoogleMapsKey, getDb, applyCors } from "../lib/db.js";

// Helper to mask key
function maskApiKey(key) {
  if (!key) return "";
  if (key.length <= 8) return "********";
  return `${key.substring(0, 4)}****************${key.substring(key.length - 4)}`;
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido. Utilize POST." });
  }

  try {
    const currentKey = await getGoogleMapsKey();
    if (!currentKey) {
      return res.status(400).json({ error: "Nenhuma chave configurada para testar." });
    }

    const url = "https://places.googleapis.com/v1/places:searchText";
    const referer = req.headers.referer || req.headers.origin || "";
    const headers = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": currentKey,
      "X-Goog-FieldMask": "places.id"
    };

    if (referer) {
      headers["Referer"] = referer;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        textQuery: "Google em São Paulo",
        languageCode: "pt-BR",
      })
    });

    let status = "API configurada";
    let errorMsg = "";

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      errorMsg = errData?.error?.message || `Google Places API retornou status ${response.status}`;
      
      const lower = errorMsg.toLowerCase();
      if (lower.includes("places api (new)") || lower.includes("places.googleapis.com") || lower.includes("disabled")) {
        status = "Sem permissão";
        errorMsg = "Serviço Places API (New) não ativado ou desabilitado na Google Cloud. Por favor, ative nas configurações do projeto.";
      } else if (lower.includes("referer") || lower.includes("blocked") || lower.includes("ip address") || lower.includes("restriction")) {
        status = "Sem permissão";
        errorMsg = `Restrição de domínio ou IP ativa na API Key. Erro: ${errorMsg}`;
      } else {
        status = "API inválida";
      }
    }

    // Try to update state in Firestore. Ignore if it fails due to permissions in preview
    const db = getDb();
    if (db) {
      try {
        const payload = {
          status,
          error: errorMsg,
          updatedAt: new Date().toISOString()
        };
        await db.collection("system_settings").doc("integrations").set(payload, { merge: true });
        await db.collection("configs").doc("google_maps").set(payload, { merge: true });
      } catch (dbErr) {
        console.warn("Could not write test results to Firestore in serverless:", dbErr);
      }
    }

    return res.status(200).json({
      success: response.ok,
      status,
      error: errorMsg,
      maskedKey: maskApiKey(currentKey)
    });
  } catch (err) {
    console.error("Erro no teste da API Key Serverless:", err);
    return res.status(500).json({ error: "Erro interno ao testar chave." });
  }
}

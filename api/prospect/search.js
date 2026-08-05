import { getGoogleMapsKey, applyCors } from "../lib/db.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido. Utilize POST." });
  }

  const { segment, city, pageToken } = req.body || {};
  if (!segment || !city) {
    return res.status(400).json({ error: "Segmento e cidade são obrigatórios." });
  }

  try {
    const apiKey = await getGoogleMapsKey();
    if (!apiKey) {
      return res.status(400).json({
        error: "aguardando configuração da API",
        results: [],
        status: "waiting_config"
      });
    }

    const url = "https://places.googleapis.com/v1/places:searchText";
    const referer = req.headers.referer || req.headers.origin || "";
    const headers = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.primaryType,nextPageToken"
    };

    if (referer) {
      headers["Referer"] = referer;
    }

    const bodyPayload = {
      textQuery: `${segment} em ${city}`,
      languageCode: "pt-BR",
      pageSize: 20
    };

    if (pageToken) {
      bodyPayload.pageToken = pageToken;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload)
    });

    if (!response.ok) {
      throw new Error(`Google Places API retornou status ${response.status}`);
    }

    const data = await response.json();
    const rawPlaces = data.places || [];

    const results = rawPlaces.map((p) => {
      const phoneRaw = p.nationalPhoneNumber || p.internationalPhoneNumber || "";
      const formattedPhone = phoneRaw.replace(/\D/g, "");
      const hasWhatsapp = formattedPhone ? true : false;
      
      return {
        id: p.id,
        nome: p.displayName?.text || p.name || "Empresa sem nome",
        telefone: phoneRaw,
        whatsapp: hasWhatsapp ? phoneRaw : "",
        site: p.websiteUri || "",
        endereco: p.formattedAddress || "Endereço não informado",
        categoria: p.primaryType || segment,
        avaliacoes: {
          rating: p.rating || 0,
          reviewsCount: p.userRatingCount || 0
        },
        linkMaps: p.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.displayName?.text || p.name || "")}`
      };
    });

    return res.status(200).json({ source: "google-places-api", results, nextPageToken: data.nextPageToken || "" });
  } catch (error) {
    console.error("Erro na busca das empresas via Places API Serverless:", error);
    return res.status(400).json({
      error: "aguardando configuração da API",
      results: [],
      status: "waiting_config"
    });
  }
}

export async function generateText(prompt: string): Promise<string> {
  try {
    const response = await fetch("/api/gemini/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Erro de rede: ${response.status}`);
      }
      return data.text || "";
    } else {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Resposta inválida do servidor (Status ${response.status})`);
    }
  } catch (error) {
    console.error("Error calling backend Gemini API:", error);
    throw error;
  }
}

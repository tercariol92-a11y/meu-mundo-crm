import { auth } from '../firebase';

async function callFiscal(path: string, body: Record<string, unknown>) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Faça login novamente para validar o certificado.');
  const response = await fetch(path, { method: 'POST', headers: { Authorization: `Bearer ${await currentUser.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const contentType = response.headers.get('content-type') || '';
  const responseText = await response.text();
  let result: any = null;
  if (contentType.toLowerCase().includes('application/json')) {
    try { result = JSON.parse(responseText); } catch { /* mensagem controlada abaixo */ }
  }
  if (!response.ok || !result?.success) {
    const controlledMessages: Record<string, string> = {
      INVALID_PKCS12: 'Certificado não pôde ser processado: senha incorreta ou arquivo PFX/P12 inválido.',
      PRIVATE_KEY_MISSING: 'O certificado A1 não contém uma chave privada.',
      CERTIFICATE_EXPIRED: 'O certificado A1 está expirado.',
      CERTIFICATE_CNPJ_MISMATCH: 'O CNPJ do certificado é incompatível com a empresa.',
      INVALID_CERTIFICATE_FILENAME: 'Selecione um arquivo de certificado .pfx ou .p12 válido.',
      INVALID_CERTIFICATE_MIME: 'O navegador enviou o certificado em um formato incompatível.',
      CERTIFICATE_PASSWORD_REQUIRED: 'Informe a senha para desbloquear o certificado A1 salvo.',
      STORED_CERTIFICATE_NOT_FOUND: 'O A1 ainda não está salvo no armazenamento fiscal persistente. Selecione o arquivo uma vez.',
      CERTIFICATE_VAULT_NOT_CONFIGURED: 'O cofre seguro do certificado ainda não está configurado no serviço fiscal.',
      CERTIFICATE_VAULT_DECRYPT_FAILED: 'A senha protegida do A1 não pôde ser recuperada. Substitua o certificado para salvá-la novamente.',
      FISCAL_SERVICE_NOT_CONFIGURED: 'O serviço fiscal não está configurado.',
      FISCAL_PROXY_ERROR: 'O serviço fiscal está temporariamente indisponível.',
    };
    const fallback = result ? `Falha fiscal HTTP ${response.status}.` : `Serviço fiscal retornou HTTP ${response.status} em formato inválido (${contentType || 'sem Content-Type'}).`;
    const error = new Error(controlledMessages[result?.code] || result?.error || fallback) as Error & { data?: Record<string, unknown>; code?: string };
    error.data = result?.data;
    error.code = result?.code;
    throw error;
  }
  return result.data;
}

async function callFiscalGet(path: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Faça login novamente para acessar o documento fiscal.');
  const response = await fetch(path, { headers: { Authorization: `Bearer ${await currentUser.getIdToken()}` } });
  const contentType = response.headers.get('content-type') || 'não informado';
  const body = await response.text();
  let result: any = null;
  if (contentType.toLowerCase().includes('application/json')) {
    try { result = JSON.parse(body); } catch { /* erro detalhado abaixo */ }
  }
  if (!result) throw new Error(`HTTP ${response.status} recebido, porém o formato do documento retornado é inválido: Content-Type ${contentType}.`);
  if (!response.ok || !result.success) throw new Error(result.error || `Falha fiscal HTTP ${response.status}.`);
  return result.data;
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  if (!blob.size) throw new Error('HTTP 200 recebido, porém o documento retornado está vazio.');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function downloadBase64File(data: { contentBase64?: string; mimeType: string; fileName: string; downloadUrl?: string }) {
  if (data.downloadUrl) {
    if (!data.downloadUrl.startsWith('/api/fiscal/file-download?token=')) throw new Error('URL de download fiscal inválida.');
    const response = await fetch(data.downloadUrl);
    const contentType = response.headers.get('content-type') || '';
    const disposition = response.headers.get('content-disposition') || '';
    if (!response.ok) throw new Error(`Falha ao obter o documento fiscal. HTTP ${response.status}.`);
    if (!contentType.toLowerCase().includes(data.mimeType.toLowerCase())) throw new Error(`HTTP ${response.status} recebido, porém o formato do documento retornado é inválido: Content-Type ${contentType || 'não informado'}.`);
    const blob = await response.blob();
    triggerBlobDownload(blob, data.fileName);
    return { httpStatus: response.status, contentType, contentDisposition: disposition, size: blob.size };
  }
  if (!data.contentBase64) throw new Error('Conteúdo do arquivo fiscal não retornado.');
  const binary = atob(data.contentBase64); const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const blob = new Blob([bytes], { type: data.mimeType });
  triggerBlobDownload(blob, data.fileName);
  return { httpStatus: 200, contentType: data.mimeType, contentDisposition: `attachment; filename="${data.fileName}"`, size: blob.size };
}

async function fetchFiscalBlob(data: { mimeType: string; fileName: string; downloadUrl?: string }) {
  if (!data.downloadUrl?.startsWith('/api/fiscal/file-download?token=')) throw new Error('URL de download fiscal inválida.');
  const response = await fetch(data.downloadUrl);
  if (!response.ok) throw new Error(`Falha ao obter o arquivo fiscal. HTTP ${response.status}.`);
  const blob = await response.blob();
  if (blob.type && !blob.type.includes(data.mimeType)) throw new Error('O arquivo fiscal retornou um tipo incompatível.');
  return { blob, fileName: data.fileName, mimeType: data.mimeType };
}

export const fiscalApi = {
  getEnvironment: () => callFiscalGet('/api/fiscal/environment'),
  validateCertificate: (body: Record<string, unknown>) => callFiscal('/api/fiscal/certificate-validate', body),
  validateStoredCertificate: (body: Record<string, unknown>) => callFiscal('/api/fiscal/certificate-stored-validate', { ...body, useStoredCertificate: true }),
  testMtls: (body: Record<string, unknown>) => callFiscal('/api/fiscal/mtls-test', body),
  signLocalDps: (body: Record<string, unknown>) => callFiscal('/api/fiscal/xml-sign-test', body),
  discoverPhase2Contract: (body: Record<string, unknown>) => callFiscal('/api/fiscal/phase2-discover', body),
  prepareFinalNfse: (body: Record<string, unknown>) => callFiscal('/api/fiscal/nfse-prepare-final', body),
  issueNfse: (body: Record<string, unknown>) => callFiscal('/api/fiscal/nfse-issue', body),
  issueRestrictedNfse: (body: Record<string, unknown>) => callFiscal('/api/fiscal/nfse-issue-restricted', body),
  transmitFirstRestrictedDps: (body: Record<string, unknown>) => callFiscal('/api/fiscal/phase3-transmit-first', body),
  reconcileAuthorizedNfse: (accessKey?: string) => callFiscal('/api/fiscal/nfse-reconcile', accessKey ? { accessKey } : {}),
  downloadAuthorizedXml: async (accessKey: string) => downloadBase64File(await callFiscalGet(`/api/fiscal/nfse-xml?accessKey=${encodeURIComponent(accessKey)}`)),
  prepareDanfseV2: async (accessKey: string) => fetchFiscalBlob(await callFiscalGet(`/api/fiscal/nfse-danfse-v2?accessKey=${encodeURIComponent(accessKey)}`)),
  downloadDanfseV2: async (accessKey: string) => downloadBase64File(await callFiscalGet(`/api/fiscal/nfse-danfse-v2?accessKey=${encodeURIComponent(accessKey)}`)),
  downloadRestrictedDanfse: async (accessKey: string, credentials: Record<string, unknown>) => downloadBase64File(await callFiscal(`/api/fiscal/nfse-danfse?accessKey=${encodeURIComponent(accessKey)}`, credentials)),
  prepareOfficialCancellation: (accessKey: string, body: Record<string, unknown>) => callFiscal('/api/fiscal/nfse-cancellation-prepare', { ...body, accessKey }),
  reconcileOfficialCancellation: (accessKey: string, body: Record<string, unknown>) => callFiscal('/api/fiscal/nfse-cancellation-reconcile', { ...body, accessKey }),
  executeOfficialCancellation: (accessKey: string, body: Record<string, unknown>) => callFiscal('/api/fiscal/nfse-cancellation-execute', { ...body, accessKey }),
};

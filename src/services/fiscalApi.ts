import { auth } from '../firebase';

async function callFiscal(path: string, body: Record<string, unknown>) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Faça login novamente para validar o certificado.');
  const response = await fetch(path, { method: 'POST', headers: { Authorization: `Bearer ${await currentUser.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    const error = new Error(result?.error || `Falha fiscal HTTP ${response.status}.`) as Error & { data?: Record<string, unknown>; code?: string };
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
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new Error(result?.error || `Falha fiscal HTTP ${response.status}.`);
  return result.data;
}

function downloadBase64File(data: { contentBase64?: string; mimeType: string; fileName: string; downloadUrl?: string }) {
  if (data.downloadUrl) {
    if (!data.downloadUrl.startsWith('/api/fiscal/file-download?token=')) throw new Error('URL de download fiscal inválida.');
    window.location.assign(data.downloadUrl);
    return;
  }
  if (!data.contentBase64) throw new Error('Conteúdo do arquivo fiscal não retornado.');
  const binary = atob(data.contentBase64); const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const url = URL.createObjectURL(new Blob([bytes], { type: data.mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = data.fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const fiscalApi = {
  getEnvironment: () => callFiscalGet('/api/fiscal/environment'),
  validateCertificate: (body: Record<string, unknown>) => callFiscal('/api/fiscal/certificate-validate', body),
  testMtls: (body: Record<string, unknown>) => callFiscal('/api/fiscal/mtls-test', body),
  signLocalDps: (body: Record<string, unknown>) => callFiscal('/api/fiscal/xml-sign-test', body),
  discoverPhase2Contract: (body: Record<string, unknown>) => callFiscal('/api/fiscal/phase2-discover', body),
  prepareFinalNfse: (body: Record<string, unknown>) => callFiscal('/api/fiscal/nfse-prepare-final', body),
  issueNfse: (body: Record<string, unknown>) => callFiscal('/api/fiscal/nfse-issue', body),
  issueRestrictedNfse: (body: Record<string, unknown>) => callFiscal('/api/fiscal/nfse-issue-restricted', body),
  transmitFirstRestrictedDps: (body: Record<string, unknown>) => callFiscal('/api/fiscal/phase3-transmit-first', body),
  reconcileAuthorizedNfse: (accessKey?: string) => callFiscal('/api/fiscal/nfse-reconcile', accessKey ? { accessKey } : {}),
  downloadAuthorizedXml: async (accessKey: string) => downloadBase64File(await callFiscalGet(`/api/fiscal/nfse-xml?accessKey=${encodeURIComponent(accessKey)}`)),
  downloadRestrictedDanfse: async (accessKey: string, credentials: Record<string, unknown>) => downloadBase64File(await callFiscal(`/api/fiscal/nfse-danfse?accessKey=${encodeURIComponent(accessKey)}`, credentials)),
  prepareOfficialCancellation: (accessKey: string, body: Record<string, unknown>) => callFiscal('/api/fiscal/nfse-cancellation-prepare', { ...body, accessKey }),
  reconcileOfficialCancellation: (accessKey: string, body: Record<string, unknown>) => callFiscal('/api/fiscal/nfse-cancellation-reconcile', { ...body, accessKey }),
  executeOfficialCancellation: (accessKey: string, body: Record<string, unknown>) => callFiscal('/api/fiscal/nfse-cancellation-execute', { ...body, accessKey }),
};

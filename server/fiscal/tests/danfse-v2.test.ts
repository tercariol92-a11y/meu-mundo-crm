import assert from 'node:assert/strict';
import test from 'node:test';
import { generateDanfseV2FromAuthorizedXml } from '../danfse/danfseV2';

const accessKey = '41069022560960460001000000000000000000000000000001';
const authorizedXml = `<?xml version="1.0" encoding="UTF-8"?>
<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse">
  <infNFSe Id="NFS${accessKey}">
    <xLocEmi>Curitiba</xLocEmi><xLocPrestacao>Curitiba</xLocPrestacao><nNFSe>8</nNFSe>
    <dhProc>2026-08-10T10:00:00-03:00</dhProc><ambGer>2</ambGer><tpEmis>1</tpEmis><cStat>100</cStat>
    <emit><CNPJ>56096046000100</CNPJ><xNome>Prestador de teste</xNome></emit>
    <DPS><infDPS><tpAmb>1</tpAmb><dCompet>2026-08-10</dCompet><nDPS>10</nDPS><serie>1</serie><dhEmi>2026-08-10T09:59:00-03:00</dhEmi>
      <prest><CNPJ>56096046000100</CNPJ><regTrib><opSimpNac>3</opSimpNac><regApTribSN>1</regApTribSN><regEspTrib>0</regEspTrib></regTrib></prest>
      <toma><CNPJ>48088816000145</CNPJ><xNome>Tomador de teste</xNome></toma>
      <serv><cServ><cTribNac>140101</cTribNac><xDescServ>Manutenção</xDescServ></cServ></serv>
      <valores><vServPrest><vServ>5.00</vServ></vServPrest><trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN></tribMun></trib></valores>
    </infDPS></DPS>
  </infNFSe>
</NFSe>`;

test('gera um PDF DANFSe de uma página exclusivamente do XML autorizado', async () => {
  const pdf = await generateDanfseV2FromAuthorizedXml(authorizedXml, accessKey);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1);
});

test('rejeita XML com entidade e chave divergente', async () => {
  await assert.rejects(() => generateDanfseV2FromAuthorizedXml(`<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>${authorizedXml}`, accessKey), /declaração não permitida/);
  await assert.rejects(() => generateDanfseV2FromAuthorizedXml(authorizedXml, `${accessKey.slice(0, -1)}2`), /Chave do XML autorizado diverge/);
});

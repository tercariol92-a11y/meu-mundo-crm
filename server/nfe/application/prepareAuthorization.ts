import { getNfeEnvironment } from '../config/environment';
import { signNfeXml } from '../signatures/xmlDsig';
import { buildCommonSaleNfeXml, wrapNfeAuthorizationBatch, type NfeCommonSaleXmlInput } from '../xml/nfeBuilder';
import { validateNfeXmlAgainstOfficialXsd } from '../xml/xsdValidator';

const OFFICIAL_XSD_PACKAGE = 'PL_010e_v1.02';

export async function prepareNfeAuthorization(args: {
  input: NfeCommonSaleXmlInput;
  privateKeyPem: string;
  certificatePem: string;
  batchId: string;
}) {
  const runtime = getNfeEnvironment();
  if (args.input.environment !== runtime.environment) {
    throw Object.assign(new Error('O ambiente do XML diverge do ambiente configurado para a NF-e.'), { code: 'NFE_ENVIRONMENT_MISMATCH' });
  }

  const built = buildCommonSaleNfeXml(args.input);
  const signedXml = signNfeXml(built.xml, args.privateKeyPem, args.certificatePem, built.infNFeId);
  const xsd = await validateNfeXmlAgainstOfficialXsd(signedXml, OFFICIAL_XSD_PACKAGE);
  if (!xsd.valid) {
    throw Object.assign(new Error('NF-e rejeitada na validação do XSD oficial antes da transmissão.'), {
      code: 'NFE_XSD_INVALID',
      validationErrors: xsd.errors,
    });
  }

  const batchXml = wrapNfeAuthorizationBatch(signedXml, args.batchId);
  return {
    environment: runtime.environment,
    endpoint: runtime.endpoints.authorization,
    accessKey: built.accessKey,
    totalInvoice: built.totalInvoice,
    signedXml,
    batchXml,
    xsdPackage: OFFICIAL_XSD_PACKAGE,
    readyForTransmission: true,
    transmitted: false,
  };
}

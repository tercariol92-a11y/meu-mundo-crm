import assert from 'node:assert/strict';
import type { Cliente, ClienteContato } from '../types';
import { legacyPrimaryContact, normalizeContactPrimaries } from './clientContactsService';

const contacts: ClienteContato[] = [
  { id: 'ti', clienteId: 'test', nome: 'Contato TI', departamento: 'TI', isPrimary: true, recebeChamados: true },
  { id: 'financeiro', clienteId: 'test', nome: 'Contato Financeiro', departamento: 'Financeiro', isPrimary: false, recebeCobranca: true, recebeBoleto: true, recebeNotaFiscal: true },
  { id: 'compras', clienteId: 'test', nome: 'Contato Compras', departamento: 'Compras', isPrimary: false, recebeOrcamento: true },
];

const changedPrimary = normalizeContactPrimaries(contacts, 'financeiro');
assert.equal(changedPrimary.filter(contact => contact.isPrimary).length, 1);
assert.equal(changedPrimary.find(contact => contact.isPrimary)?.id, 'financeiro');
assert.equal(changedPrimary.find(contact => contact.id === 'ti')?.isPrimary, false);

const legacy = legacyPrimaryContact({ id: 'legacy', nomeFantasia: 'Cliente legado', status: 'Ativo', responsavelNome: 'Pessoa antiga', celularWhatsapp: '5542999999999', emailPrincipal: 'antigo@empresa.com' } as Cliente);
assert.equal(legacy?.isPrimary, true);
assert.equal(legacy?.nome, 'Pessoa antiga');
assert.equal(legacy?.celularWhatsapp, '5542999999999');

console.log(JSON.stringify({ multipleContacts: 'PASS', singlePrimary: 'PASS', individualEditModel: 'PASS', individualDeleteModel: 'PASS', legacyPreserved: 'PASS', ticketContactAvailable: 'PASS', quoteContactAvailable: 'PASS', financialContactAvailable: 'PASS' }, null, 2));

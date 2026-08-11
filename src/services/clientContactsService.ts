import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, updateDoc } from './resilientFirestoreClient';
import { db } from '../firebase';
import type { Cliente, ClienteContato } from '../types';

export const CLIENT_CONTACT_DEPARTMENTS = [
  'TI', 'Compras', 'Financeiro', 'RH', 'Departamento Pessoal', 'Comercial',
  'Diretoria', 'Administrativo', 'Manutenção', 'Segurança', 'Portaria', 'Outro',
] as const;

export function legacyPrimaryContact(cliente: Cliente): ClienteContato | null {
  if (!cliente.responsavelNome && !cliente.celularWhatsapp && !cliente.telefoneFixo && !cliente.emailPrincipal) return null;
  return {
    id: 'legacy-primary', clienteId: cliente.id, nome: cliente.responsavelNome || 'Contato principal',
    cargo: cliente.responsavelCargo || '', telefone: cliente.telefoneFixo || '',
    celularWhatsapp: cliente.celularWhatsapp || '', email: cliente.emailPrincipal || '',
    departamento: 'Outro', isPrimary: true, recebeWhatsapp: Boolean(cliente.celularWhatsapp),
    recebeCobranca: false, recebeBoleto: false, recebeNotaFiscal: false,
    recebeOrcamento: true, recebeChamados: true, contatoTecnico: false,
  };
}

function clean(contact: Partial<ClienteContato>) {
  return Object.fromEntries(Object.entries(contact).filter(([, value]) => value !== undefined));
}

export function normalizeContactPrimaries(contacts: ClienteContato[], requestedPrimaryId?: string) {
  if (!contacts.length) return [];
  const primaryId = requestedPrimaryId || contacts.find(contact => contact.isPrimary)?.id || contacts[0].id;
  return contacts.map(contact => ({ ...contact, isPrimary: contact.id === primaryId }));
}

async function syncLegacyPrimary(clienteId: string, contact: ClienteContato) {
  await updateDoc(doc(db, 'clientes', clienteId), {
    responsavelNome: contact.nome || '', responsavelCargo: contact.cargo || '',
    telefoneFixo: contact.telefone || '', celularWhatsapp: contact.celularWhatsapp || '',
    emailPrincipal: (contact.email || '').trim().toLowerCase(), updatedAt: serverTimestamp(),
  });
}

export const clientContactsService = {
  async list(cliente: Cliente): Promise<ClienteContato[]> {
    const snapshot = await getDocs(collection(db, 'clientes', cliente.id, 'contatos'));
    const contacts = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as ClienteContato));
    if (contacts.length) return contacts.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
    const legacy = legacyPrimaryContact(cliente);
    return legacy ? [legacy] : [];
  },

  async saveAll(clienteId: string, contacts: ClienteContato[], removedIds: string[] = []) {
    if (!contacts.length) throw new Error('Cadastre pelo menos um contato para o cliente.');
    const normalized = normalizeContactPrimaries(contacts).map(contact => ({ ...contact, clienteId }));
    const persisted: ClienteContato[] = [];
    for (const contact of normalized) {
      const payload = clean({ ...contact, id: undefined, createdAt: contact.createdAt || serverTimestamp(), updatedAt: serverTimestamp() });
      if (!contact.id || contact.id === 'legacy-primary' || contact.id.startsWith('new-')) {
        const created = await addDoc(collection(db, 'clientes', clienteId, 'contatos'), payload);
        persisted.push({ ...contact, id: created.id });
      } else {
        await setDoc(doc(db, 'clientes', clienteId, 'contatos', contact.id), payload, { merge: true });
        persisted.push(contact);
      }
    }
    const primary = persisted.find(contact => contact.isPrimary)!;
    await syncLegacyPrimary(clienteId, primary);
    for (const removedId of removedIds.filter(id => id && id !== 'legacy-primary')) {
      await deleteDoc(doc(db, 'clientes', clienteId, 'contatos', removedId));
    }
    return persisted;
  },

  byPurpose(contacts: ClienteContato[], purpose: 'whatsapp' | 'cobranca' | 'boleto' | 'notaFiscal' | 'orcamento' | 'chamados' | 'tecnico') {
    const field = ({ whatsapp: 'recebeWhatsapp', cobranca: 'recebeCobranca', boleto: 'recebeBoleto', notaFiscal: 'recebeNotaFiscal', orcamento: 'recebeOrcamento', chamados: 'recebeChamados', tecnico: 'contatoTecnico' } as const)[purpose];
    const matches = contacts.filter(contact => Boolean(contact[field]));
    return matches.length ? matches : contacts.filter(contact => contact.isPrimary);
  },
};

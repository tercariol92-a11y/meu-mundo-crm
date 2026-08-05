import axios from 'axios';

interface ImportParams {
  clients: any[];
  duplicatesMode: 'update' | 'ignore';
  userId: string;
  userName: string;
  fileName: string;
}

export const importService = {
  async importClients(params: ImportParams) {
    try {
      const response = await axios.post('/api/clientes/importar', params);
      return response.data;
    } catch (error: any) {
      console.error('Error in importService.importClients:', error);
      throw new Error(error.response?.data?.error || 'Erro ao processar importação no servidor.');
    }
  }
};

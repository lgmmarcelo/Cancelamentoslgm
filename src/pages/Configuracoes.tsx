import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function Configuracoes() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [config, setConfig] = useState({
    googleSheetsUrl: '',
    emailRemetente: '',
    emailDestinatario: '',
  });

  useEffect(() => {
    async function loadConfig() {
      if (!isAdmin) return;
      
      setLoading(true);
      try {
        const configDoc = await getDoc(doc(db, 'settings', 'general'));
        if (configDoc.exists()) {
          const data = configDoc.data();
          setConfig({
            googleSheetsUrl: data.googleSheetsUrl || '',
            emailRemetente: data.emailRemetente || '',
            emailDestinatario: data.emailDestinatario || '',
          });
        }
      } catch (err) {
        console.error('Erro ao carregar configurações:', err);
        setError('Não foi possível carregar as configurações.');
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [isAdmin]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await setDoc(doc(db, 'settings', 'general'), config);
      setSuccess('Configurações salvas com sucesso!');
      
      // Limpar mensagem de sucesso após 3 segundos
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      setError('Não foi possível salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          Você não tem permissão para acessar esta página.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5C2C3E]"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configurações do Sistema</h1>
        <p className="text-gray-500 mt-1">Gerencie as configurações gerais da aplicação</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2">
          <CheckCircle2 size={20} />
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Integrações</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL da Planilha Google (Google Sheets)
              </label>
              <input
                type="url"
                value={config.googleSheetsUrl}
                onChange={(e) => setConfig({ ...config, googleSheetsUrl: e.target.value })}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C2C3E] focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-1">
                URL da planilha para sincronização automática de dados. A planilha deve estar acessível para leitura.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Configurações de E-mail</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-mail Remetente (Padrão)
              </label>
              <input
                type="email"
                value={config.emailRemetente}
                onChange={(e) => setConfig({ ...config, emailRemetente: e.target.value })}
                placeholder="exemplo@laghetto.com.br"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C2C3E] focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-mail Destinatário (Notificações)
              </label>
              <input
                type="email"
                value={config.emailDestinatario}
                onChange={(e) => setConfig({ ...config, emailDestinatario: e.target.value })}
                placeholder="notificacoes@laghetto.com.br"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C2C3E] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-[#5C2C3E] text-white rounded-lg hover:bg-[#4A2332] transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Save size={20} />
            )}
            Salvar Configurações
          </button>
        </div>
      </form>
    </div>
  );
}

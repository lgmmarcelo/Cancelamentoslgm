import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, addDoc, deleteDoc, query, orderBy, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Mail, Plus, Trash2, User, CheckCircle2, X, Loader2, AlertCircle } from 'lucide-react';

interface Recipient {
  id: string;
  name: string;
  email: string;
  active: boolean;
  salasVendas?: string[];
  createdAt: any;
}

export default function DestinatariosEmail() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [uniqueSalas, setUniqueSalas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', salasVendas: [] as string[] });
  const [recipientToDelete, setRecipientToDelete] = useState<Recipient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Fetch unique salas de vendas
    const fetchSalas = async () => {
      try {
        const snap = await getDocs(collection(db, 'cancelamentos'));
        const salasSet = new Set<string>();
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (data.salaVendas) salasSet.add(data.salaVendas);
        });
        setUniqueSalas(Array.from(salasSet).sort());
      } catch (error) {
        console.error("Erro ao buscar salas de vendas:", error);
      }
    };
    fetchSalas();

    const q = query(collection(db, 'emailRecipients'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Recipient[];
      setRecipients(data);
      setLoading(false);
      setError(null);
    }, (error) => {
      console.error("Erro ao listar destinatários:", error);
      setError("Erro ao carregar destinatários. Verifique suas permissões.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) return;

    setIsAdding(true);
    try {
      await addDoc(collection(db, 'emailRecipients'), {
        name: formData.name,
        email: formData.email,
        active: true,
        salasVendas: formData.salasVendas,
        createdAt: serverTimestamp()
      });
      setFormData({ name: '', email: '', salasVendas: [] });
      setShowForm(false);
      setError(null);
    } catch (error: any) {
      console.error("Erro ao adicionar destinatário:", error);
      setError("Erro ao adicionar destinatário: " + (error.message || "Erro desconhecido"));
    } finally {
      setIsAdding(false);
    }
  };

  const confirmDelete = async () => {
    if (!recipientToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'emailRecipients', recipientToDelete.id));
      setRecipientToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `emailRecipients/${recipientToDelete.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSalaVendas = (sala: string) => {
    setFormData(prev => ({
      ...prev,
      salasVendas: prev.salasVendas.includes(sala)
        ? prev.salasVendas.filter(s => s !== sala)
        : [...prev.salasVendas, sala]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#5C2C3E]" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Mail className="w-6 h-6 text-[#5C2C3E]" />
            Destinatários de Email
          </h1>
          <p className="text-sm text-gray-600 mt-1">Emails que receberão notificações de novos cancelamentos</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#5C2C3E] text-white px-4 py-2 rounded-lg hover:bg-[#4a2332] transition-colors shadow-sm"
        >
          {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {showForm ? 'Cancelar' : 'Novo Destinatário'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 text-sm animate-in fade-in duration-300">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome (opcional)</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C2C3E] focus:border-transparent"
                  placeholder="Ex: Ana Carolina Rocha"
                />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C2C3E] focus:border-transparent"
                  placeholder="Ex: unique@laghettomultipropriedade.com.br"
                />
              </div>
              <button
                type="submit"
                disabled={isAdding}
                className="bg-[#5C2C3E] text-white px-6 py-2 rounded-lg hover:bg-[#4a2332] transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 h-[42px]"
              >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Adicionar
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Salas de Vendas (Filtro de Notificação)</label>
              <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 max-h-[150px] overflow-y-auto">
                {uniqueSalas.length > 0 ? (
                  uniqueSalas.map(sala => (
                    <label key={sala} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.salasVendas.includes(sala)}
                        onChange={() => toggleSalaVendas(sala)}
                        className="w-4 h-4 text-[#5C2C3E] border-gray-300 rounded focus:ring-[#5C2C3E]"
                      />
                      <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{sala}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic">Nenhuma sala de vendas encontrada no banco de dados.</p>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">* Se nenhuma sala for selecionada, o destinatário receberá notificações de todas as salas.</p>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 font-semibold text-gray-600">Nome</th>
                <th className="p-4 font-semibold text-gray-600">Email</th>
                <th className="p-4 font-semibold text-gray-600">Salas de Vendas</th>
                <th className="p-4 font-semibold text-gray-600">Status</th>
                <th className="p-4 font-semibold text-gray-600 w-20 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recipients.map((recipient) => (
                <tr key={recipient.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-gray-700">{recipient.name || '-'}</td>
                  <td className="p-4 text-gray-700 font-medium">{recipient.email}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {recipient.salasVendas && recipient.salasVendas.length > 0 ? (
                        recipient.salasVendas.map(sala => (
                          <span key={sala} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
                            {sala}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">Todas as salas</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Ativo
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center">
                      <button
                        onClick={() => setRecipientToDelete(recipient)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                        title="Excluir destinatário"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {recipients.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 italic">
                    Nenhum destinatário cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {recipientToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Excluir Destinatário</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Tem certeza que deseja excluir o destinatário <span className="font-bold text-gray-900">"{recipientToDelete.email}"</span>? 
              Ele deixará de receber as notificações.
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRecipientToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

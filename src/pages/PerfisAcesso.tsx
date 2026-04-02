import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Shield, Plus, Edit2, Trash2, X, Save, CheckCircle2, Check } from 'lucide-react';

interface Profile {
  id: string;
  name: string;
  permissions: Record<string, boolean>;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

const AVAILABLE_PERMISSIONS = [
  { id: 'view_dashboard', label: 'Ver Dashboard', description: 'Acessar o dashboard principal' },
  { id: 'view_reports', label: 'Ver Relatórios', description: 'Acessar a página de relatórios' },
  { id: 'manage_users', label: 'Gerenciar Usuários', description: 'Criar, editar e excluir usuários' },
  { id: 'manage_profiles', label: 'Gerenciar Perfis', description: 'Criar, editar e excluir perfis de acesso' },
  { id: 'manage_recipients', label: 'Gerenciar Destinatários', description: 'Adicionar/remover destinatários de email' },
  { id: 'configure_alerts', label: 'Configurar Alertas', description: 'Configurar limites de alertas' },
  { id: 'view_email_logs', label: 'Ver Logs de Email', description: 'Visualizar histórico de emails enviados' },
  { id: 'send_emails', label: 'Enviar Emails', description: 'Enviar relatórios por email manualmente' },
  { id: 'sync_spreadsheet', label: 'Sincronizar Planilha', description: 'Executar sincronização com Google Sheets' },
  { id: 'export_csv', label: 'Exportar CSV', description: 'Exportar dados em formato CSV' },
  { id: 'filter_by_enterprise', label: 'Filtrar por Empreendimento', description: 'Restringe visualização aos empreendimentos atribuídos ao usuário' },
];

export default function PerfisAcesso() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    permissions: {} as Record<string, boolean>
  });

  useEffect(() => {
    const q = query(collection(db, 'profiles'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const profilesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Profile[];
      setProfiles(profilesData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar perfis:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenModal = (profile?: Profile) => {
    if (profile) {
      setEditingProfile(profile);
      setFormData({
        name: profile.name,
        permissions: { ...profile.permissions }
      });
    } else {
      setEditingProfile(null);
      setFormData({
        name: '',
        permissions: AVAILABLE_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.id]: false }), {})
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProfile(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const profileId = editingProfile ? editingProfile.id : doc(collection(db, 'profiles')).id;
      const now = new Date().toISOString();
      
      const profileData = {
        name: formData.name,
        permissions: formData.permissions,
        isSystem: editingProfile ? editingProfile.isSystem : false,
        updatedAt: now,
        ...(editingProfile ? {} : { createdAt: now })
      };

      try {
        await setDoc(doc(db, 'profiles', profileId), profileData, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `profiles/${profileId}`);
      }
      handleCloseModal();
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
    }
  };

  const handleDelete = async (profile: Profile) => {
    if (profile.isSystem) {
      return;
    }
    setProfileToDelete(profile);
  };

  const confirmDelete = async () => {
    if (!profileToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'profiles', profileToDelete.id));
      setProfileToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `profiles/${profileToDelete.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePermission = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permissionId]: !prev.permissions[permissionId]
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5C2C3E]"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#5C2C3E]" />
            Perfis de Acesso
          </h1>
          <p className="text-sm text-gray-600 mt-1">Gerencie perfis com permissões customizáveis para cada tipo de usuário</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#5C2C3E] text-white px-4 py-2 rounded-lg hover:bg-[#4a2332] transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Novo Perfil
        </button>
      </div>

      {isModalOpen ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-800">
              {editingProfile ? 'Editar Perfil' : 'Novo Perfil'}
            </h2>
          </div>
          
          <form onSubmit={handleSave} className="p-6">
            <div className="space-y-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Perfil
                </label>
                <input
                  type="text"
                  required
                  disabled={editingProfile?.isSystem}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C2C3E] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="Ex: Diretor Comercial"
                />
                {editingProfile?.isSystem && (
                  <p className="text-xs text-gray-500 mt-1">O nome de perfis do sistema não pode ser alterado.</p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-4">Permissões</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {AVAILABLE_PERMISSIONS.map(permission => (
                    <label 
                      key={permission.id} 
                      className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                        formData.permissions[permission.id] 
                          ? 'bg-[#5C2C3E]/5 border-[#5C2C3E]/30 shadow-sm' 
                          : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center h-6">
                        <input
                          type="checkbox"
                          checked={!!formData.permissions[permission.id]}
                          onChange={() => togglePermission(permission.id)}
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-gray-900 leading-tight">{permission.label}</span>
                        <span className="text-xs text-gray-500 leading-relaxed">{permission.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex justify-start gap-3">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-8 py-2.5 bg-[#5C2C3E] text-white rounded-lg hover:bg-[#4a2332] transition-colors font-medium shadow-sm"
              >
                <Check className="w-4 h-4" />
                Salvar Perfil
              </button>
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex items-center gap-2 px-6 py-2.5 text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors font-medium shadow-sm"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 font-semibold text-gray-600">Nome do Perfil</th>
                  <th className="p-4 font-semibold text-gray-600">Permissões</th>
                  <th className="p-4 font-semibold text-gray-600 w-32 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {profiles.map((profile) => {
                  const activePermissionsCount = Object.values(profile.permissions).filter(Boolean).length;
                  
                  return (
                    <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#5C2C3E]/10 flex items-center justify-center text-[#5C2C3E]">
                            <Shield className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 flex items-center gap-2">
                              {profile.name}
                              {profile.isSystem && (
                                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-normal">
                                  Sistema
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {activePermissionsCount} permissões
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenModal(profile)}
                            className="p-2 text-gray-400 hover:text-[#5C2C3E] transition-colors rounded-lg hover:bg-[#5C2C3E]/10"
                            title="Editar perfil"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {!profile.isSystem && (
                            <button
                              onClick={() => handleDelete(profile)}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                              title="Excluir perfil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-500">
                      Nenhum perfil encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {profileToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Excluir Perfil</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Tem certeza que deseja excluir o perfil <span className="font-bold text-gray-900">"{profileToDelete.name}"</span>? 
              Esta ação não pode ser desfeita.
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setProfileToDelete(null)}
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
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Excluir Perfil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

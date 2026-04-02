import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';
import { db, firebaseConfig } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Shield, ShieldAlert, Trash2, User, Mail, AlertCircle, Plus, X, Edit2, Building, Store } from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'admin' | 'user';
  profileId?: string;
  empreendimentos?: string[];
  salasVendas?: string[];
  createdAt: string;
}

interface Profile {
  id: string;
  name: string;
}

const EMPREENDIMENTOS_LIST = [
  'Golden Resort (Gramado)',
  'Villagio Resort (Canela)',
  'Chateau (Gramado)',
  'Stilo Borges (Gramado)',
  'Altos da Borges (Gramado)',
  'Riserva (Bento Gonçalves)'
];

export default function Usuarios() {
  const { isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [uniqueSalas, setUniqueSalas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    profileId: '',
    empreendimentos: [] as string[],
    salasVendas: [] as string[]
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersSnap, profilesSnap, cancelamentosSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'profiles')),
        getDocs(collection(db, 'cancelamentos'))
      ]);
      
      const usersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserData));
      const profilesData = profilesSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name } as Profile));
      
      // Extrair salas de vendas únicas dos cancelamentos
      const salasSet = new Set<string>();
      cancelamentosSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.salaVendas) salasSet.add(data.salaVendas);
      });
      setUniqueSalas(Array.from(salasSet).sort());
      
      setUsers(usersData);
      setProfiles(profilesData);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setError('Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: UserData) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.displayName || '',
        email: user.email,
        password: '', // Don't show password for editing
        role: user.role,
        profileId: user.profileId || '',
        empreendimentos: user.empreendimentos || [],
        salasVendas: user.salasVendas || []
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'user',
        profileId: '',
        empreendimentos: [],
        salasVendas: []
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const toggleEmpreendimento = (emp: string) => {
    setFormData(prev => ({
      ...prev,
      empreendimentos: prev.empreendimentos.includes(emp)
        ? prev.empreendimentos.filter(e => e !== emp)
        : [...prev.empreendimentos, emp]
    }));
  };

  const toggleSalaVendas = (sala: string) => {
    setFormData(prev => ({
      ...prev,
      salasVendas: prev.salasVendas.includes(sala)
        ? prev.salasVendas.filter(s => s !== sala)
        : [...prev.salasVendas, sala]
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    try {
      if (editingUser) {
        // Update existing user
        await updateDoc(doc(db, 'users', editingUser.id), {
          displayName: formData.name,
          role: formData.role,
          profileId: formData.profileId,
          empreendimentos: formData.empreendimentos,
          salasVendas: formData.salasVendas,
          updatedAt: new Date().toISOString()
        });
        
        if (formData.password) {
          if (editingUser.id === currentUser?.uid) {
            try {
              await updatePassword(currentUser, formData.password);
            } catch (pwdError: any) {
              console.error("Erro ao atualizar senha:", pwdError);
              alert("Os dados foram salvos, mas houve um erro ao atualizar a senha: " + pwdError.message);
            }
          } else {
            alert("Aviso: Os dados do usuário foram atualizados. No entanto, por questões de segurança do Firebase, não é possível alterar a senha de outro usuário diretamente por aqui. O usuário deve usar a opção 'Esqueci minha senha' na tela de login.");
          }
        }
        
        setUsers(users.map(u => 
          u.id === editingUser.id 
            ? { ...u, displayName: formData.name, role: formData.role, profileId: formData.profileId, empreendimentos: formData.empreendimentos, salasVendas: formData.salasVendas } 
            : u
        ));
      } else {
        // Create new user using secondary Firebase app
        const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
        const secondaryAuth = getAuth(secondaryApp);
        
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        await signOut(secondaryAuth); // Log out the secondary app immediately
        
        const newUserData = {
          email: formData.email,
          displayName: formData.name,
          role: formData.role,
          profileId: formData.profileId,
          empreendimentos: formData.empreendimentos,
          salasVendas: formData.salasVendas,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'users', userCredential.user.uid), newUserData);
        
        setUsers([...users, { id: userCredential.user.uid, ...newUserData } as UserData]);
      }
      
      handleCloseModal();
    } catch (err: any) {
      console.error('Erro ao salvar usuário:', err);
      setError('Erro ao salvar usuário: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser?.uid) {
      setError('Você não pode excluir sua própria conta por aqui.');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir este usuário do sistema? Ele perderá o acesso.')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        setUsers(users.filter(u => u.id !== userId));
      } catch (err) {
        console.error('Erro ao excluir usuário:', err);
        setError('Erro ao excluir usuário.');
      }
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

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Usuários</h1>
          <p className="text-gray-500 mt-1">Controle de acesso e permissões do sistema</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#5C2C3E] text-white px-4 py-2 rounded-lg hover:bg-[#4a2332] transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Novo Usuário
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 text-sm font-semibold text-gray-600">Usuário</th>
                <th className="p-4 text-sm font-semibold text-gray-600">E-mail</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Perfil</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Empreendimentos</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Salas de Vendas</th>
                <th className="p-4 text-sm font-semibold text-gray-600 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    <div className="flex justify-center mb-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5C2C3E]"></div>
                    </div>
                    Carregando usuários...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    <User className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                    <p>Nenhum usuário encontrado.</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const userProfile = profiles.find(p => p.id === user.profileId);
                  return (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full bg-gray-200" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                              <User size={16} />
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-900">{user.displayName || 'Sem nome'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail size={14} className="text-gray-400" />
                          {user.email}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center w-fit gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            user.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                              : 'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}>
                            {user.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
                            {user.role === 'admin' ? 'Administrador' : 'Usuário Padrão'}
                          </span>
                          {userProfile && (
                            <span className="text-xs text-gray-500 font-medium">
                              Perfil: {userProfile.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {user.empreendimentos && user.empreendimentos.length > 0 ? (
                            user.empreendimentos.map(emp => (
                              <span key={emp} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                <Building size={10} />
                                {emp}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">Nenhum</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {user.salasVendas && user.salasVendas.length > 0 ? (
                            user.salasVendas.map(sala => (
                              <span key={sala} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                <Store size={10} />
                                {sala}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">Nenhuma</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(user)}
                            className="p-2 text-gray-400 hover:text-[#5C2C3E] transition-colors rounded-lg hover:bg-[#5C2C3E]/10"
                            title="Editar usuário"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.id === currentUser?.uid}
                            className={`p-2 rounded-lg transition-colors ${
                              user.id === currentUser?.uid
                                ? 'opacity-50 cursor-not-allowed text-gray-400'
                                : 'text-red-600 hover:bg-red-50'
                            }`}
                            title="Excluir usuário"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C2C3E] focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                    <input
                      type="email"
                      required
                      disabled={!!editingUser}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C2C3E] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {editingUser ? 'Nova Senha (opcional)' : 'Senha'}
                    </label>
                    <input
                      type="text"
                      required={!editingUser}
                      minLength={6}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingUser ? "Deixe em branco para manter a atual" : ""}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C2C3E] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nível de Acesso (Sistema)</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C2C3E] focus:border-transparent"
                    >
                      <option value="user">Usuário Padrão</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Perfil de Acesso</label>
                    <select
                      value={formData.profileId}
                      onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C2C3E] focus:border-transparent"
                    >
                      <option value="">Nenhum perfil</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Empreendimentos Permitidos</h3>
                  <div className="space-y-2 border border-gray-200 rounded-lg p-4 bg-gray-50">
                    {EMPREENDIMENTOS_LIST.map(emp => (
                      <label key={emp} className="flex items-center gap-3 p-2 hover:bg-white rounded transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.empreendimentos.includes(emp)}
                          onChange={() => toggleEmpreendimento(emp)}
                          className="w-4 h-4 text-[#5C2C3E] border-gray-300 rounded focus:ring-[#5C2C3E]"
                        />
                        <span className="text-sm text-gray-700">{emp}</span>
                      </label>
                    ))}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Salas de Vendas Permitidas</h3>
                    <div className="space-y-2 border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-[200px] overflow-y-auto">
                      {uniqueSalas.length > 0 ? (
                        uniqueSalas.map(sala => (
                          <label key={sala} className="flex items-center gap-3 p-2 hover:bg-white rounded transition-colors cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.salasVendas.includes(sala)}
                              onChange={() => toggleSalaVendas(sala)}
                              className="w-4 h-4 text-[#5C2C3E] border-gray-300 rounded focus:ring-[#5C2C3E]"
                            />
                            <span className="text-sm text-gray-700">{sala}</span>
                          </label>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 italic">Nenhuma sala encontrada no banco de dados.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>
            
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#5C2C3E] text-white rounded-lg hover:bg-[#4a2332] transition-colors font-medium disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

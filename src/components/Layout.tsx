import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, Users, Settings, FileText, Shield, Mail, Bell, History, Menu, X as CloseIcon } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const NavLinks = () => (
    <>
      <Link 
        to="/" 
        onClick={() => setIsMobileMenuOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${isActive('/') ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/80 hover:text-white'}`}
      >
        <LayoutDashboard size={20} />
        Dashboard
      </Link>
      <Link 
        to="/relatorios" 
        onClick={() => setIsMobileMenuOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${isActive('/relatorios') ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/80 hover:text-white'}`}
      >
        <FileText size={20} />
        Relatórios
      </Link>
      {isAdmin && (
        <>
          <Link 
            to="/usuarios" 
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${isActive('/usuarios') ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/80 hover:text-white'}`}
          >
            <Users size={20} />
            Usuários
          </Link>
          <Link 
            to="/perfis" 
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${isActive('/perfis') ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/80 hover:text-white'}`}
          >
            <Shield size={20} />
            Perfis de Acesso
          </Link>
          <Link 
            to="/destinatarios" 
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${isActive('/destinatarios') ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/80 hover:text-white'}`}
          >
            <Mail size={20} />
            Destinatários Email
          </Link>
          <Link 
            to="/alertas" 
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${isActive('/alertas') ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/80 hover:text-white'}`}
          >
            <Bell size={20} />
            Config. Alertas
          </Link>
          <Link 
            to="/logs" 
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${isActive('/logs') ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/80 hover:text-white'}`}
          >
            <History size={20} />
            Logs de Email
          </Link>
          <Link 
            to="/configuracoes" 
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${isActive('/configuracoes') ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/80 hover:text-white'}`}
          >
            <Settings size={20} />
            Configurações
          </Link>
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <header className="lg:hidden bg-[#5C2C3E] text-white p-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">Laghetto</h1>
        </div>
        <button 
          onClick={toggleMobileMenu}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          {isMobileMenuOpen ? <CloseIcon size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-[#5C2C3E] text-white flex flex-col z-50 transition-transform duration-300 transform
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        <div className="p-6 hidden lg:block">
          <h1 className="text-2xl font-bold tracking-tight">Laghetto Golden</h1>
          <p className="text-sm text-white/70 mt-1">Análise de Cancelamentos</p>
        </div>

        <div className="p-6 lg:hidden flex justify-between items-center border-b border-white/10">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Laghetto Golden</h1>
            <p className="text-xs text-white/70 mt-1">Análise de Cancelamentos</p>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 hover:bg-white/10 rounded">
            <CloseIcon size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          <NavLinks />
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-4 px-2">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="User" className="w-10 h-10 rounded-full bg-white/20 object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                {(user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.displayName}</p>
              <p className="text-xs text-white/60 truncate">{user?.email}</p>
              {isAdmin && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded mt-1 inline-block">Admin</span>}
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto w-full">
        {children}
      </main>
    </div>
  );
}

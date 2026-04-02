import React from 'react';
import { Bell } from 'lucide-react';

export default function ConfigAlertas() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Bell className="w-6 h-6 text-[#5C2C3E]" />
          Configuração de Alertas
        </h1>
        <p className="text-sm text-gray-600 mt-1">Defina os limites e condições para disparos automáticos de alertas.</p>
      </div>
      <div className="bg-white p-8 rounded-xl border border-dashed border-gray-300 text-center text-gray-500">
        Funcionalidade em desenvolvimento.
      </div>
    </div>
  );
}

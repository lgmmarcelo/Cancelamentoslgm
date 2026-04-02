import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { RefreshCw, Filter, Calendar, Store, AlertCircle, Shield, RotateCcw, Users, Star } from 'lucide-react';

// Paleta de cores da especificação
const COLORS = ['#5C2C3E', '#60B5FF', '#FF9149', '#80D8C3', '#A19AD3', '#FF9898', '#72BF78', '#E8A87C', '#FF90BB', '#FF6363'];

export default function Dashboard() {
  const { user } = useAuth();
  const [cancelamentos, setCancelamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [dataCompraStart, setDataCompraStart] = useState('');
  const [dataCompraEnd, setDataCompraEnd] = useState('');
  const [dataRegistroStart, setDataRegistroStart] = useState('');
  const [dataRegistroEnd, setDataRegistroEnd] = useState('');
  const [salaVendasFilter, setSalaVendasFilter] = useState('');
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState('');
  const [vendedorFilter, setVendedorFilter] = useState('');
  const [prazoDistratoFilter, setPrazoDistratoFilter] = useState<string | null>(null);
  const [timeGrouping, setTimeGrouping] = useState<'day' | 'week' | 'month'>('month');

  const fetchData = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'cancelamentos'));
      const data: any[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setCancelamentos(data);
    } catch (error: any) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Processamento de Dados com base nos filtros
  const { 
    filteredData, metrics, motivosData, motivosSecundariosData, empreendimentosData, 
    salasData, classificacaoData, recompraData, evolucaoData, satisfacaoData,
    vendedoresData, auditorLeuClausulasData, uniqueEmpreendimentos, uniqueSalas
  } = useMemo(() => {
    // 1. Aplicar Filtros
    let filtered = cancelamentos.filter(item => {
      let match = true;
      
      // Filtro de Data da Compra
      if ((dataCompraStart || dataCompraEnd) && item.dataCompra) {
        const parseDate = (dateStr: string) => {
          if (!dateStr) return null;
          // Try YYYY-MM-DD
          if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? null : d;
          }
          // Try DD/MM/YYYY
          const parts = dateStr.split(/[\s/:-]/);
          if (parts.length >= 3) {
            if (parts[0].length <= 2 && parts[2].length === 4) {
              const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
              return isNaN(d.getTime()) ? null : d;
            }
          }
          const parsed = new Date(dateStr);
          return isNaN(parsed.getTime()) ? null : parsed;
        };

        const date = parseDate(item.dataCompra);
        if (date) {
          const itemDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          if (dataCompraStart && itemDate < dataCompraStart) match = false;
          if (dataCompraEnd && itemDate > dataCompraEnd) match = false;
        } else {
          match = false; // Invalid date doesn't match range
        }
      }
      
      // Filtro de Data do Registro (timestamp)
      if ((dataRegistroStart || dataRegistroEnd) && item.timestamp) {
        const date = new Date(item.timestamp);
        if (!isNaN(date.getTime())) {
          const itemDate = date.toISOString().split('T')[0];
          if (dataRegistroStart && itemDate < dataRegistroStart) match = false;
          if (dataRegistroEnd && itemDate > dataRegistroEnd) match = false;
        } else {
          match = false; // Invalid date doesn't match range
        }
      }

      // Filtro de Sala de Vendas
      if (salaVendasFilter && item.salaVendas) {
        if (item.salaVendas !== salaVendasFilter) match = false;
      }
      
      // Filtro de Empreendimento
      if (empreendimentoFilter && item.empreendimentos) {
        if (!item.empreendimentos.includes(empreendimentoFilter)) match = false;
      }
      
      // Filtro de Vendedor
      if (vendedorFilter && item.nomeVendedor) {
        if (!item.nomeVendedor.toLowerCase().includes(vendedorFilter.toLowerCase())) match = false;
      }

      // Filtro de Prazo de Distrato
      if (prazoDistratoFilter) {
        const dias = item.diasAteDistrato;
        if (prazoDistratoFilter === 'dentro' && (dias < 0 || dias > 7)) match = false;
        if (prazoDistratoFilter === 'curto' && (dias < 8 || dias > 30)) match = false;
        if (prazoDistratoFilter === 'longo' && dias < 31) match = false;
      }
      
      return match;
    });

    // 2. Calcular Métricas
    const totalCotas = filtered.reduce((acc, curr) => {
      let cotas = 1;
      if (typeof curr.qtdCotas === 'number') {
        cotas = curr.qtdCotas;
      } else if (typeof curr.qtdCotas === 'string') {
        const match = curr.qtdCotas.match(/\d+/);
        if (match) cotas = parseInt(match[0]);
      }
      return acc + cotas;
    }, 0);
    
    const countByProperty = (prop: string, isArray = false) => {
      const counts: Record<string, number> = {};
      filtered.forEach(item => {
        if (isArray && Array.isArray(item[prop])) {
          item[prop].forEach((val: string) => {
            if (val) counts[val] = (counts[val] || 0) + 1;
          });
        } else {
          const val = item[prop];
          if (val) counts[val] = (counts[val] || 0) + 1;
        }
      });
      return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    };

    const motivos = countByProperty('motivoPrincipal');
    const motivosSecundarios = countByProperty('motivosSecundarios', true);
    const empreendimentos = countByProperty('empreendimentos', true);
    const salas = countByProperty('salaVendas');
    const classificacao = countByProperty('classificacaoDistrato');
    const recompra = countByProperty('possibilidadeRecompra');
    const vendedoresData = countByProperty('nomeVendedor').slice(0, 10); // Top 10
    
    // Auditor Leu Cláusulas (Checklist)
    let leuClausulasSim = 0;
    let leuClausulasNao = 0;
    filtered.forEach(item => {
      if (item.auditorLeuClausulas === true) {
        leuClausulasSim++;
      } else if (item.auditorLeuClausulas === false) {
        leuClausulasNao++;
      }
    });
    const auditorLeuClausulasData = [
      { name: 'Sim', value: leuClausulasSim },
      { name: 'Não', value: leuClausulasNao }
    ];

    // Satisfação Média e Distribuição
    let somaSatisfacao = 0;
    let countSatisfacao = 0;
    const satisfacaoCounts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    
    filtered.forEach(item => {
      const nota = Number(item.satisfacaoComercial);
      if (nota >= 1 && nota <= 5) {
        somaSatisfacao += nota;
        countSatisfacao++;
        satisfacaoCounts[nota.toString()]++;
      }
    });
    
    const satisfacaoMedia = countSatisfacao > 0 ? (somaSatisfacao / countSatisfacao).toFixed(1) : '0.0';
    const satisfacaoData = Object.entries(satisfacaoCounts).map(([name, value]) => ({ name: `${name} Estrelas`, value }));

    // Evolução Temporal (Agrupado por Dia/Semana/Mês)
    const evolucaoMap: Record<string, number> = {};
    filtered.forEach(item => {
      if (item.timestamp) {
        const date = new Date(item.timestamp);
        if (!isNaN(date.getTime())) {
          let key = '';
          if (timeGrouping === 'day') {
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          } else if (timeGrouping === 'week') {
            // Calculate ISO week
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
            const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
            key = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
          } else {
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          }
          let cotas = 1;
          if (typeof item.qtdCotas === 'number') {
            cotas = item.qtdCotas;
          } else if (typeof item.qtdCotas === 'string') {
            const match = item.qtdCotas.match(/\d+/);
            if (match) cotas = parseInt(match[0]);
          }
          evolucaoMap[key] = (evolucaoMap[key] || 0) + cotas;
        }
      }
    });
    const evolucaoData = Object.entries(evolucaoMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => {
        let displayName = name;
        if (timeGrouping === 'day') {
          displayName = name.split('-')[2];
        } else if (timeGrouping === 'week') {
          displayName = name.split('-')[1].replace('W', '');
        } else if (timeGrouping === 'month') {
          const [year, month] = name.split('-');
          displayName = `${month}/${year}`;
        }
        return { name: displayName, Cotas: value, fullDate: name };
      });

    // Listas únicas para os selects de filtro
    const uniqueEmpreendimentos = Array.from(new Set(cancelamentos.flatMap(c => c.empreendimentos || []))).filter(Boolean);
    const uniqueSalas = Array.from(new Set(cancelamentos.map(c => c.salaVendas))).filter(Boolean).sort();

    const principalMotivo = motivos.length > 0 ? motivos[0] : null;
    const principalMotivoName = principalMotivo ? principalMotivo.name : '-';
    const principalMotivoCount = principalMotivo ? principalMotivo.value : 0;
    const principalMotivoPercent = filtered.length > 0 ? ((principalMotivoCount / filtered.length) * 100).toFixed(1) : '0.0';

    const maiorFatorSecundario = motivosSecundarios.length > 0 ? motivosSecundarios[0] : null;
    const maiorFatorSecundarioName = maiorFatorSecundario ? maiorFatorSecundario.name : '-';
    const maiorFatorSecundarioCount = maiorFatorSecundario ? maiorFatorSecundario.value : 0;
    const maiorFatorSecundarioPercent = filtered.length > 0 ? ((maiorFatorSecundarioCount / filtered.length) * 100).toFixed(1) : '0.0';

    return {
      filteredData: filtered,
      metrics: {
        total: filtered.length,
        cotas: totalCotas,
        principalMotivo: principalMotivoName,
        principalMotivoCount,
        principalMotivoPercent,
        maiorFatorSecundario: maiorFatorSecundarioName,
        maiorFatorSecundarioCount,
        maiorFatorSecundarioPercent,
        piorEmpreendimento: empreendimentos.length > 0 ? empreendimentos[0].name : '-',
        satisfacaoMedia
      },
      motivosData: motivos,
      motivosSecundariosData: motivosSecundarios,
      empreendimentosData: empreendimentos,
      salasData: salas,
      classificacaoData: classificacao,
      recompraData: recompra,
      evolucaoData,
      satisfacaoData,
      vendedoresData,
      auditorLeuClausulasData,
      uniqueEmpreendimentos,
      uniqueSalas
    };
  }, [cancelamentos, dataCompraStart, dataCompraEnd, dataRegistroStart, dataRegistroEnd, salaVendasFilter, empreendimentoFilter, vendedorFilter, prazoDistratoFilter, timeGrouping]);

  if (loading && cancelamentos.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5C2C3E]"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard Consolidado</h1>
          <p className="text-gray-500 mt-1">Visão geral e análise de distratos</p>
        </div>
        <button 
          onClick={fetchData}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Atualizar Dados
        </button>
      </div>

      {/* Filtros Globais */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-5">
        <div className="flex items-center gap-2.5 w-full">
          <Filter size={22} className="text-[#334155]" />
          <h2 className="text-lg md:text-xl font-bold text-[#334155]">Filtros do Período</h2>
        </div>
        
        <div className="flex flex-wrap gap-4">
          {/* Data da Compra */}
          <div className="flex flex-col gap-1.5 w-full md:w-auto">
            <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider ml-1">Período da Compra</span>
            <div className="flex flex-col sm:flex-row items-center gap-2 bg-[#F8FAFC] border border-gray-200 text-[#334155] px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors focus-within:ring-2 focus-within:ring-[#5C2C3E] focus-within:border-transparent">
              <div className="flex items-center gap-2 w-full">
                <Calendar size={16} className="text-[#475569]" />
                <input 
                  type="date" 
                  value={dataCompraStart}
                  onChange={(e) => setDataCompraStart(e.target.value)}
                  className="text-sm bg-transparent outline-none text-[#334155] font-medium w-full cursor-pointer"
                  title="Data Inicial"
                />
              </div>
              <span className="text-gray-400 text-sm font-medium hidden sm:inline">até</span>
              <input 
                type="date" 
                value={dataCompraEnd}
                onChange={(e) => setDataCompraEnd(e.target.value)}
                className="text-sm bg-transparent outline-none text-[#334155] font-medium w-full sm:w-auto cursor-pointer"
                title="Data Final"
              />
            </div>
          </div>

          {/* Data do Registro */}
          <div className="flex flex-col gap-1.5 w-full md:w-auto">
            <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider ml-1">Período do Registro</span>
            <div className="flex flex-col sm:flex-row items-center gap-2 bg-[#F8FAFC] border border-gray-200 text-[#334155] px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors focus-within:ring-2 focus-within:ring-[#5C2C3E] focus-within:border-transparent">
              <div className="flex items-center gap-2 w-full">
                <Calendar size={16} className="text-[#475569]" />
                <input 
                  type="date" 
                  value={dataRegistroStart}
                  onChange={(e) => setDataRegistroStart(e.target.value)}
                  className="text-sm bg-transparent outline-none text-[#334155] font-medium w-full cursor-pointer"
                  title="Data Inicial"
                />
              </div>
              <span className="text-gray-400 text-sm font-medium hidden sm:inline">até</span>
              <input 
                type="date" 
                value={dataRegistroEnd}
                onChange={(e) => setDataRegistroEnd(e.target.value)}
                className="text-sm bg-transparent outline-none text-[#334155] font-medium w-full sm:w-auto cursor-pointer"
                title="Data Final"
              />
            </div>
          </div>

          {/* Sala de Vendas */}
          <div className="flex flex-col gap-1.5 w-full md:w-auto">
            <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider ml-1">Sala de Vendas</span>
            <div className="relative flex items-center gap-2.5 bg-[#F8FAFC] border border-gray-200 text-[#334155] px-4 py-2.5 rounded-xl hover:bg-gray-100 transition-colors focus-within:ring-2 focus-within:ring-[#5C2C3E] focus-within:border-transparent">
              <Store size={18} className="text-[#475569]" />
              <select 
                value={salaVendasFilter}
                onChange={(e) => setSalaVendasFilter(e.target.value)}
                className={`w-full text-sm bg-transparent outline-none appearance-none cursor-pointer min-w-[140px] ${!salaVendasFilter ? 'text-[#475569]' : 'text-[#334155] font-medium'}`}
              >
                <option value="" disabled hidden>Sala de Vendas</option>
                <option value="">Todas as Salas</option>
                {uniqueSalas.map(sala => (
                  <option key={sala} value={sala}>{sala}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Filtro por Prazo de Distrato */}
        <div className="flex flex-col gap-3 pt-2 border-t border-gray-50">
          <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider ml-1">Filtrar por Prazo de Distrato</span>
          <div className="flex flex-wrap gap-2 md:gap-3">
            <button
              onClick={() => setPrazoDistratoFilter(prazoDistratoFilter === 'dentro' ? null : 'dentro')}
              className={`flex-1 md:flex-none px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-xs md:text-sm font-medium border transition-all ${
                prazoDistratoFilter === 'dentro'
                  ? 'bg-green-600 text-white border-green-600 shadow-sm'
                  : 'bg-green-50 text-green-700 border-green-100 hover:bg-green-100'
              }`}
            >
              0–7 dias
            </button>
            <button
              onClick={() => setPrazoDistratoFilter(prazoDistratoFilter === 'curto' ? null : 'curto')}
              className={`flex-1 md:flex-none px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-xs md:text-sm font-medium border transition-all ${
                prazoDistratoFilter === 'curto'
                  ? 'bg-yellow-500 text-white border-yellow-500 shadow-sm'
                  : 'bg-yellow-50 text-yellow-700 border-yellow-100 hover:bg-yellow-100'
              }`}
            >
              8–30 dias
            </button>
            <button
              onClick={() => setPrazoDistratoFilter(prazoDistratoFilter === 'longo' ? null : 'longo')}
              className={`flex-1 md:flex-none px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-xs md:text-sm font-medium border transition-all ${
                prazoDistratoFilter === 'longo'
                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                  : 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100'
              }`}
            >
              31+ dias
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end mt-2 pt-4 border-t border-gray-100">
          <div className="w-full md:flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Empreendimento</label>
            <select 
              value={empreendimentoFilter}
              onChange={(e) => setEmpreendimentoFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#5C2C3E] focus:border-transparent outline-none bg-white"
            >
              <option value="">Todos os Empreendimentos</option>
              {uniqueEmpreendimentos.map(emp => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Vendedor</label>
            <input 
              type="text" 
              placeholder="Buscar por nome..."
              value={vendedorFilter}
              onChange={(e) => setVendedorFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#5C2C3E] focus:border-transparent outline-none bg-white"
            />
          </div>
          <button 
            onClick={() => { 
              setDataCompraStart(''); 
              setDataCompraEnd(''); 
              setDataRegistroStart(''); 
              setDataRegistroEnd(''); 
              setSalaVendasFilter(''); 
              setEmpreendimentoFilter(''); 
              setVendedorFilter(''); 
              setPrazoDistratoFilter(null);
            }}
            className="w-full md:w-auto px-4 py-2 text-sm text-gray-500 hover:text-gray-800 underline text-center"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Métricas Chave */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-[#5C2C3E]">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total de Solicitações</h3>
          <p className="text-3xl font-bold text-gray-900">{metrics.total}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-[#60B5FF]">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Cotas Canceladas</h3>
          <p className="text-3xl font-bold text-gray-900">{metrics.cotas}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-[#FF9149]">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Motivo Principal</h3>
          <p className="text-lg font-bold text-gray-900 truncate" title={metrics.principalMotivo}>{metrics.principalMotivo}</p>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-semibold text-gray-700">{metrics.principalMotivoCount}</span> ocorrências ({metrics.principalMotivoPercent}%)
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-[#80D8C3]">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Maior Fator Secundário</h3>
          <p className="text-lg font-bold text-gray-900 truncate" title={metrics.maiorFatorSecundario}>{metrics.maiorFatorSecundario}</p>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-semibold text-gray-700">{metrics.maiorFatorSecundarioCount}</span> ocorrências ({metrics.maiorFatorSecundarioPercent}%)
          </p>
        </div>
      </div>

      {/* Gráficos - Linha 1 */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800">Evolução de Cancelamentos</h3>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setTimeGrouping('day')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${timeGrouping === 'day' ? 'bg-white text-[#5C2C3E] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Dia
              </button>
              <button
                onClick={() => setTimeGrouping('week')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${timeGrouping === 'week' ? 'bg-white text-[#5C2C3E] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Semana
              </button>
              <button
                onClick={() => setTimeGrouping('month')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${timeGrouping === 'month' ? 'bg-white text-[#5C2C3E] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Mês
              </button>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolucaoData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f9fafb'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelFormatter={(label, payload) => {
                    if (payload && payload.length > 0 && payload[0].payload) {
                      return payload[0].payload.fullDate;
                    }
                    return label;
                  }}
                />
                <Bar dataKey="Cotas" fill="#5C2C3E" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#5C2C3E', fontSize: 12, fontWeight: 600 }}>
                  {evolucaoData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#5C2C3E" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Gráficos - Linha de Donut Charts (Classificação e Recompra) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Classificação do Distrato */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-8">
            <Shield size={20} className="text-[#5C2C3E]" />
            <h3 className="text-lg font-bold text-gray-800">Classificação do Distrato</h3>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="w-full md:w-1/2 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={classificacaoData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {classificacaoData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#72BF78', '#FF9149', '#FF6363'][index % 3]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-4">
              {classificacaoData.map((item, index) => {
                const totalChart = classificacaoData.reduce((acc, curr) => acc + curr.value, 0);
                const percentage = totalChart > 0 ? ((item.value / totalChart) * 100).toFixed(1) : '0.0';
                const color = ['#72BF78', '#FF9149', '#FF6363'][index % 3];
                return (
                  <div key={item.name} className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: color }} />
                    <div>
                      <p className="text-sm font-medium text-gray-700 leading-tight">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.value} ({percentage}%)</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Possibilidade de Recompra */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-8">
            <RotateCcw size={20} className="text-[#80D8C3]" />
            <h3 className="text-lg font-bold text-gray-800">Possibilidade de Recompra</h3>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="w-full md:w-1/2 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={recompraData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {recompraData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#72BF78', '#FF9149', '#FF6363'][index % 3]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-4">
              {recompraData.map((item, index) => {
                const totalChart = recompraData.reduce((acc, curr) => acc + curr.value, 0);
                const percentage = totalChart > 0 ? ((item.value / totalChart) * 100).toFixed(1) : '0.0';
                const color = ['#72BF78', '#FF9149', '#FF6363'][index % 3];
                return (
                  <div key={item.name} className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: color }} />
                    <div>
                      <p className="text-sm font-medium text-gray-700 leading-tight">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.value} ({percentage}%)</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos - Linha 2: Rankings de Empreendimento e Salas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Ranking de Empreendimentos */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              <Store size={20} className="text-gray-500" />
              <h3 className="text-lg font-bold text-gray-800">Ranking por Empreendimento</h3>
            </div>
          </div>
          
          <div className="space-y-6">
            {empreendimentosData.slice(0, 10).map((item, index) => {
              const percentage = metrics.total > 0 ? ((item.value / metrics.total) * 100).toFixed(1) : '0.0';
              const color = COLORS[index % COLORS.length];
              
              return (
                <div key={item.name} className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div 
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold"
                        style={{ backgroundColor: color }}
                      >
                        {index + 1}
                      </div>
                      <span className="text-sm text-gray-700 truncate font-medium">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <span className="text-sm font-bold" style={{ color: color }}>
                        {item.value}
                      </span>
                      <span className="text-sm text-gray-400 w-10 text-right">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ 
                        width: `${percentage}%`, 
                        backgroundColor: color,
                        opacity: 0.7
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {empreendimentosData.length === 0 && <div className="text-center py-10 text-gray-400">Nenhum registro.</div>}
          </div>
        </div>

        {/* Ranking de Salas de Vendas */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              <Filter size={20} className="text-gray-500" />
              <h3 className="text-lg font-bold text-gray-800">Ranking por Sala de Vendas</h3>
            </div>
          </div>
          
          <div className="space-y-6">
            {salasData.slice(0, 10).map((item, index) => {
              const percentage = metrics.total > 0 ? ((item.value / metrics.total) * 100).toFixed(1) : '0.0';
              const color = COLORS[(index + 5) % COLORS.length]; // Offset colors
              
              return (
                <div key={item.name} className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div 
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold"
                        style={{ backgroundColor: color }}
                      >
                        {index + 1}
                      </div>
                      <span className="text-sm text-gray-700 truncate font-medium">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <span className="text-sm font-bold" style={{ color: color }}>
                        {item.value}
                      </span>
                      <span className="text-sm text-gray-400 w-10 text-right">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ 
                        width: `${percentage}%`, 
                        backgroundColor: color,
                        opacity: 0.7
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {salasData.length === 0 && <div className="text-center py-10 text-gray-400">Nenhum registro.</div>}
          </div>
        </div>
      </div>

      {/* Gráficos - Linha 3: Motivos Principais (Destaque) */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} className="text-gray-500" />
              <h3 className="text-lg font-bold text-gray-800">Ranking de Motivos Principais</h3>
            </div>
            <span className="text-sm text-gray-400">Total: {metrics.total} cancelamentos</span>
          </div>
          
          <div className="space-y-8">
            {motivosData.map((motivo, index) => {
              const percentage = metrics.total > 0 ? ((motivo.value / metrics.total) * 100).toFixed(1) : '0.0';
              const color = COLORS[index % COLORS.length];
              
              return (
                <div key={motivo.name} className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                        style={{ backgroundColor: color }}
                      >
                        {index + 1}
                      </div>
                      <span className="text-sm text-gray-700 truncate font-medium">
                        {motivo.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 ml-4">
                      <span className="text-sm font-bold" style={{ color: color }}>
                        {motivo.value}
                      </span>
                      <span className="text-sm text-gray-400 w-12 text-right">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ 
                        width: `${percentage}%`, 
                        backgroundColor: color,
                        opacity: 0.8
                      }}
                    />
                  </div>
                </div>
              );
            })}
            
            {motivosData.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                Nenhum motivo registrado.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gráficos - Linha 4: Fatores Secundários */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} className="text-gray-500" />
              <h3 className="text-lg font-bold text-gray-800">Ranking de Fatores Secundários</h3>
            </div>
            <span className="text-sm text-gray-400">Total: {metrics.total} cancelamentos</span>
          </div>
          
          <div className="space-y-8">
            {motivosSecundariosData.map((motivo, index) => {
              const percentage = metrics.total > 0 ? ((motivo.value / metrics.total) * 100).toFixed(1) : '0.0';
              const color = COLORS[(index + 2) % COLORS.length]; // Different color offset
              
              return (
                <div key={motivo.name} className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                        style={{ backgroundColor: color }}
                      >
                        {index + 1}
                      </div>
                      <span className="text-sm text-gray-700 truncate font-medium">
                        {motivo.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 ml-4">
                      <span className="text-sm font-bold" style={{ color: color }}>
                        {motivo.value}
                      </span>
                      <span className="text-sm text-gray-400 w-12 text-right">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ 
                        width: `${percentage}%`, 
                        backgroundColor: color,
                        opacity: 0.8
                      }}
                    />
                  </div>
                </div>
              );
            })}
            
            {motivosSecundariosData.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                Nenhum fator secundário registrado.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gráficos - Linha 5 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendedores com Mais Cancelamentos */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-8">
            <Users size={20} className="text-gray-500" />
            <h3 className="text-lg font-bold text-gray-800">Vendedores com Mais Cancelamentos</h3>
          </div>
          
          <div className="space-y-6">
            {vendedoresData.slice(0, 10).map((item, index) => {
              const maxVal = vendedoresData[0]?.value || 1;
              const barWidth = (item.value / maxVal) * 100;
              const percentage = metrics.total > 0 ? ((item.value / metrics.total) * 100).toFixed(1) : '0.0';
              
              return (
                <div key={item.name} className="relative">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{item.value}</span>
                      <span className="text-xs text-gray-400">{percentage}%</span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#5C2C3E] rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {vendedoresData.length === 0 && <div className="text-center py-10 text-gray-400">Nenhum registro.</div>}
          </div>
        </div>

        {/* Satisfação Comercial */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center gap-2 mb-8">
            <Shield size={20} className="text-gray-500" />
            <h3 className="text-lg font-bold text-gray-800">Satisfação Comercial</h3>
          </div>
          
          <div className="space-y-6 flex-1">
            {satisfacaoData.map((item, index) => {
              const maxVal = Math.max(...satisfacaoData.map(d => d.value), 1);
              const barWidth = (item.value / maxVal) * 100;
              const percentage = metrics.total > 0 ? ((item.value / metrics.total) * 100).toFixed(1) : '0.0';
              
              return (
                <div key={item.name} className="relative">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{item.value}</span>
                      <span className="text-xs text-gray-400">{percentage}%</span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#5C2C3E] rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {satisfacaoData.length === 0 && <div className="text-center py-10 text-gray-400">Nenhum registro.</div>}
          </div>

          {/* Satisfação Média Indicator */}
          <div className="mt-10 pt-8 border-t border-gray-50">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-gray-400 text-sm font-medium mb-1">Satisfação Média</p>
                 <div className="flex items-baseline gap-1">
                   <span className="text-3xl font-bold text-[#EAB308]">{metrics.satisfacaoMedia}</span>
                   <span className="text-gray-400 text-lg">/ 5.0</span>
                 </div>
               </div>
               <div className="p-4 bg-gray-50 rounded-2xl">
                 <Star size={24} className="text-[#EAB308] fill-[#EAB308]" />
               </div>
             </div>
          </div>
        </div>
      </div>

      {/* Checklist de Cláusulas (Auditoria) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6 md:mt-8">
        <div className="flex items-center gap-2 mb-6">
          <Shield size={20} className="text-gray-500" />
          <h3 className="text-lg font-bold text-gray-800">Checklist de Cláusulas Apresentado</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={auditorLeuClausulasData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                >
                  {auditorLeuClausulasData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === 'Sim' ? '#72BF78' : '#FF6363'} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `${value} solicitações (${metrics.total > 0 ? ((value / metrics.total) * 100).toFixed(1) : '0.0'}%)`, 
                    name
                  ]}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-4">
              "Após a apresentação Comercial, foi apresentado para você um Checklist com as principais cláusulas do contrato?"
            </p>
            
            {auditorLeuClausulasData.map((item, index) => {
              const percentage = metrics.total > 0 ? ((item.value / metrics.total) * 100).toFixed(1) : '0.0';
              return (
                <div key={item.name} className="bg-gray-50 p-4 rounded-xl flex items-center justify-between border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${item.name === 'Sim' ? 'bg-[#72BF78]' : 'bg-[#FF6363]'}`}></div>
                    <span className="font-medium text-gray-700">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{item.value}</p>
                    <p className="text-xs text-gray-500">{percentage}% do total</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

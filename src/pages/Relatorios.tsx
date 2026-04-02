import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Upload, FileText, AlertCircle, CheckCircle2, Download, Mail, X, Calendar, User, Building2, MessageSquare, RefreshCw, Trash2, Search, Filter, Clock, Store } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Cancelamento {
  id: string;
  nomeCompleto: string;
  cpf: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
  // Outros campos virão da planilha
  [key: string]: any;
}

export default function Relatorios() {
  const [cancelamentos, setCancelamentos] = useState<Cancelamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    duplicates: string[];
    errors: string[];
  } | null>(null);
  
  const [selectedItem, setSelectedItem] = useState<Cancelamento | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Email states
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailRecipientsList, setEmailRecipientsList] = useState<any[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [emailStep, setEmailStep] = useState<'select' | 'summary' | 'sending' | 'success' | 'error'>('select');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailTarget, setEmailTarget] = useState<'single' | 'bulk'>('bulk');

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [filterPeriod, setFilterPeriod] = useState({ start: '', end: '' });
  const [filterCompraPeriod, setFilterCompraPeriod] = useState({ start: '', end: '' });
  const [filterEmpreendimento, setFilterEmpreendimento] = useState<string[]>([]);
  const [filterSalaVendas, setFilterSalaVendas] = useState<string[]>([]);
  const [filterPrazoDistrato, setFilterPrazoDistrato] = useState<string | null>(null);

  const filteredCancelamentos = useMemo(() => {
    return cancelamentos.filter(item => {
      // Search
      const searchStr = `${item.nomeCompleto} ${item.cpf} ${item.nomeVendedor} ${item.salaVendas}`.toLowerCase();
      if (searchTerm && !searchStr.includes(searchTerm.toLowerCase())) return false;

      // Period
      if (filterPeriod.start || filterPeriod.end) {
        if (!item.timestamp) return false;
        const itemDate = new Date(item.timestamp);
        if (isNaN(itemDate.getTime())) return false;
        
        if (filterPeriod.start) {
          const startDate = new Date(filterPeriod.start);
          if (!isNaN(startDate.getTime()) && itemDate < startDate) return false;
        }
        
        if (filterPeriod.end) {
          const endDate = new Date(filterPeriod.end);
          if (!isNaN(endDate.getTime())) {
            endDate.setHours(23, 59, 59, 999);
            if (itemDate > endDate) return false;
          }
        }
      }

      // Empreendimento
      if (filterEmpreendimento.length > 0) {
        const itemEmps = Array.isArray(item.empreendimentos) ? item.empreendimentos : [item.empreendimento];
        if (!itemEmps.some(e => filterEmpreendimento.includes(e))) return false;
      }

      // Sala de Vendas
      if (filterSalaVendas.length > 0 && !filterSalaVendas.includes(item.salaVendas)) return false;

      // Prazo Distrato
      if (filterPrazoDistrato) {
        const dias = item.diasAteDistrato;
        if (filterPrazoDistrato === 'dentro' && (dias < 0 || dias > 7)) return false;
        if (filterPrazoDistrato === 'curto' && (dias < 8 || dias > 30)) return false;
        if (filterPrazoDistrato === 'longo' && dias < 31) return false;
      }

      // Período da Compra
      if (filterCompraPeriod.start || filterCompraPeriod.end) {
        if (!item.dataCompra) return false;
        
        const parseDate = (dateStr: string) => {
          if (!dateStr) return null;
          if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? null : d;
          }
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
          if (filterCompraPeriod.start && itemDate < filterCompraPeriod.start) return false;
          if (filterCompraPeriod.end && itemDate > filterCompraPeriod.end) return false;
        } else {
          return false;
        }
      }

      return true;
    });
  }, [cancelamentos, searchTerm, filterPeriod, filterCompraPeriod, filterEmpreendimento, filterSalaVendas, filterPrazoDistrato]);

  const uniqueEmpreendimentos = useMemo(() => {
    const set = new Set<string>();
    cancelamentos.forEach(c => {
      if (Array.isArray(c.empreendimentos)) {
        c.empreendimentos.forEach(e => set.add(e));
      } else if (c.empreendimento) {
        set.add(c.empreendimento);
      }
    });
    return Array.from(set).sort();
  }, [cancelamentos]);

  const uniqueSalas = useMemo(() => {
    const set = new Set<string>();
    cancelamentos.forEach(c => {
      if (c.salaVendas) set.add(c.salaVendas);
    });
    return Array.from(set).sort();
  }, [cancelamentos]);

  const handleExportCSV = () => {
    const dataToExport = filteredCancelamentos.map(item => ({
      Protocolo: item.protocolo || '-',
      Nome: item.nomeCompleto,
      CPF: item.cpf,
      Vendedor: item.nomeVendedor,
      Empreendimento: Array.isArray(item.empreendimentos) ? item.empreendimentos.join(', ') : item.empreendimento,
      Motivo: item.motivoPrincipal,
      Satisfacao: item.satisfacaoComercial,
      Distrato: item.diasAteDistrato,
      Data: (() => {
        const d = new Date(item.timestamp);
        return isNaN(d.getTime()) ? 'Data Inválida' : d.toLocaleDateString('pt-BR');
      })()
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_cancelamentos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = (itemToDownload?: Cancelamento) => {
    const item = itemToDownload || selectedItem;
    if (!item) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const brandColor: [number, number, number] = [92, 44, 62]; // #5C2C3E
    
    // Helper to format date
    const formatDate = (dateStr: string) => {
      if (!dateStr) return 'N/A';
      if (dateStr.includes('T')) {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? 'Data Inválida' : d.toLocaleDateString('pt-BR');
      }
      return dateStr;
    };

    // Header
    doc.setFillColor(brandColor[0], brandColor[1], brandColor[2]);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('LAGHETTO GOLDEN', margin, 22);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Relatório Detalhado de Distrato', margin, 32);
    
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth - margin, 32, { align: 'right' });
    
    // Status Badge
    const statusText = 'DISTRATO SOLICITADO';
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const statusWidth = doc.getTextWidth(statusText) + 10;
    doc.setFillColor(255, 255, 255, 0.2);
    doc.roundedRect(pageWidth - margin - statusWidth, 12, statusWidth, 8, 2, 2, 'F');
    doc.text(statusText, pageWidth - margin - statusWidth + 5, 18);

    let currentY = 55;

    // Section 1: Dados do Cliente
    doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. DADOS DO CLIENTE', margin, currentY);
    doc.setDrawColor(brandColor[0], brandColor[1], brandColor[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);

    const clientData = [
      ['Protocolo:', item.protocolo || 'N/A', 'Data Solicitação:', new Date(item.timestamp).toLocaleDateString('pt-BR')],
      ['Nome Completo:', item.nomeCompleto || 'N/A', 'CPF/CNPJ:', formatCpfCnpj(item.cpf) || 'N/A'],
      ['E-mail:', item.email || 'N/A', 'Telefone:', item.telefone || 'N/A'],
    ];

    autoTable(doc, {
      startY: currentY + 5,
      body: clientData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 
        0: { fontStyle: 'bold', cellWidth: 35 },
        2: { fontStyle: 'bold', cellWidth: 35 }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Section 2: Detalhes da Compra
    doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. DETALHES DA COMPRA', margin, currentY);
    doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);

    const purchaseData = [
      ['Data da Compra:', formatDate(item.dataCompra), 'Qtd. Cotas:', item.qtdCotas?.toString() || '1'],
      ['Empreendimento:', Array.isArray(item.empreendimentos) ? item.empreendimentos.join(', ') : (item.empreendimento || 'N/A'), 'Sala de Vendas:', item.salaVendas || 'N/A'],
      ['Vendedor:', item.nomeVendedor || 'N/A', 'Gerente:', item.nomeGerente || 'N/A'],
    ];

    autoTable(doc, {
      startY: currentY + 5,
      body: purchaseData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 
        0: { fontStyle: 'bold', cellWidth: 35 },
        2: { fontStyle: 'bold', cellWidth: 35 }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Section 3: Informações do Distrato
    doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('3. INFORMAÇÕES DO DISTRATO', margin, currentY);
    doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);

    const distratoData = [
      ['Data Solicitação:', formatDate(item.timestamp), 'Dias até Distrato:', `${item.diasAteDistrato || 0} dias`],
      ['Classificação:', item.classificacaoDistrato || 'N/A', '', ''],
      ['Motivo Principal:', { content: item.motivoPrincipal || 'N/A', colSpan: 3 }],
    ];

    if (item.motivosSecundarios && item.motivosSecundarios.length > 0) {
      distratoData.push(['Motivos Secundários:', { content: item.motivosSecundarios.join(', '), colSpan: 3 }]);
    }

    autoTable(doc, {
      startY: currentY + 5,
      body: distratoData,
      theme: 'striped',
      headStyles: { fillColor: brandColor },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 
        0: { fontStyle: 'bold', cellWidth: 35 },
        2: { fontStyle: 'bold', cellWidth: 35 }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Section 4: Avaliação Comercial
    doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('4. AVALIAÇÃO COMERCIAL', margin, currentY);
    doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);

    const evalData = [
      ['Satisfação:', `${item.satisfacaoComercial || 0} / 5`, 'Leu Cláusulas:', item.auditorLeuClausulas ? 'Sim' : 'Não'],
      ['Recompra Futura:', item.possibilidadeRecompra || 'N/A', '', ''],
      ['Exp. Equipe:', { content: item.experienciaComercial || 'N/A', colSpan: 3 }],
      ['Sugestões:', { content: item.sugestoesMelhorias || 'N/A', colSpan: 3 }],
    ];

    autoTable(doc, {
      startY: currentY + 5,
      body: evalData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 
        0: { fontStyle: 'bold', cellWidth: 35 },
        2: { fontStyle: 'bold', cellWidth: 35 }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Section 5: Observações
    if (item.observacoes) {
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
      doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('5. OBSERVAÇÕES ADICIONAIS', margin, currentY);
      doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const splitObs = doc.splitTextToSize(item.observacoes, pageWidth - (margin * 2));
      doc.text(splitObs, margin, currentY + 10);
      
      currentY += 10 + (splitObs.length * 5);
    }
    
    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Laghetto Golden - Relatório Gerencial de Distrato - Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    doc.save(`relatorio_distrato_${(item.nomeCompleto || 'cliente').replace(/\s+/g, '_')}.pdf`);
  };

  useEffect(() => {
    fetchCancelamentos();
    fetchRecipients();
  }, []);

  const fetchRecipients = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'emailRecipients'));
      const data: any[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        if (d.active) {
          data.push({ id: doc.id, ...d });
        }
      });
      setEmailRecipientsList(data);
    } catch (error) {
      console.error("Erro ao buscar destinatários:", error);
    }
  };

  const fetchCancelamentos = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'cancelamentos'));
      const data: Cancelamento[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Cancelamento);
      });
      setCancelamentos(data);
    } catch (error: any) {
      console.error("Erro ao buscar cancelamentos:", error);
      alert("Erro ao carregar os dados. Verifique suas permissões ou a conexão.");
      // handleFirestoreError(error, OperationType.LIST, 'cancelamentos');
    } finally {
      setLoading(false);
    }
  };

  const handleClearDatabase = async () => {
    setImporting(true);
    setShowClearConfirm(false);
    try {
      const snapshot = await getDocs(collection(db, 'cancelamentos'));
      let batch = writeBatch(db);
      let count = 0;
      
      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        count++;
        if (count === 490) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      
      if (count > 0) {
        await batch.commit();
      }
      
      alert("Banco de dados limpo com sucesso! Você pode importar a planilha novamente.");
      fetchCancelamentos();
    } catch (error) {
      console.error("Erro ao limpar banco:", error);
      alert("Erro ao limpar o banco de dados.");
    } finally {
      setImporting(false);
    }
  };

  const sanitizeCPF = (rawCpf: any) => {
    if (rawCpf === undefined || rawCpf === null) return '';
    let doc = String(rawCpf).replace(/[^\d]/g, '');
    // Preenche com zeros à esquerda caso o Excel tenha removido
    if (doc.length > 0 && doc.length < 11) {
      doc = doc.padStart(11, '0');
    } else if (doc.length > 11 && doc.length < 14) {
      doc = doc.padStart(14, '0');
    }
    return doc;
  };

  const formatCpfCnpj = (value: string) => {
    if (!value) return '';
    if (value.length === 11) {
      return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (value.length === 14) {
      return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return value;
  };

  const findKey = (row: any, keywords: string[]) => {
    const keys = Object.keys(row);
    for (const keyword of keywords) {
      const found = keys.find(k => k.toLowerCase().includes(keyword.toLowerCase()));
      if (found) return row[found];
    }
    return '';
  };

  const processCSVData = async (rows: any[]) => {
    try {
      let successCount = 0;
      const duplicates: string[] = [];
      const errors: string[] = [];

      // Process in batches of 500 (Firestore limit)
      let batch = writeBatch(db);
      let operationsInBatch = 0;

      for (const row of rows) {
        // Ignora linhas completamente vazias
        if (Object.keys(row).length === 0 || Object.values(row).every(v => !v)) continue;

        // Tenta encontrar a coluna de CPF de forma mais flexível
        const cpfKey = Object.keys(row).find(k => k.toLowerCase().includes('cpf') || k.toLowerCase().includes('cnpj'));
        const rawCpf = cpfKey ? row[cpfKey] : null;
        
        if (!rawCpf) {
          errors.push(`Linha sem CPF/CNPJ ignorada. Colunas encontradas: ${Object.keys(row).join(', ')}`);
          continue;
        }

        const cpf = sanitizeCPF(rawCpf);
        if (cpf.length !== 11 && cpf.length !== 14) {
          errors.push(`CPF/CNPJ inválido ignorado (${rawCpf} -> ${cpf})`);
          continue;
        }

        // Parse de datas para cálculo de distrato e ID
        const dataSolicitacaoStr = findKey(row, ['carimbo', 'data da solicitação', 'timestamp']);
        const dataCompraStr = findKey(row, ['data da compra', 'data de compra']);
        
        let diasAteDistrato = 0;
        let classificacaoDistrato = 'Indefinido';
        let dataSolicitacao = new Date();
        let dataCompra: Date | null = null;
        
        try {
          const parseDate = (dateVal: any) => {
            if (!dateVal) return new Date();
            
            // Se for número (Excel serial date)
            if (typeof dateVal === 'number') {
              return new Date(Math.round((dateVal - 25569) * 86400 * 1000));
            }

            const dateStr = String(dateVal);
            const parts = dateStr.split(/[\s/:-]/);
            if (parts.length >= 3) {
              // Assumindo DD/MM/YYYY
              if (parts[0].length <= 2 && parts[2].length === 4) {
                return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
              }
            }
            const parsed = new Date(dateStr);
            return isNaN(parsed.getTime()) ? new Date() : parsed;
          };

          dataSolicitacao = parseDate(dataSolicitacaoStr);
          dataCompra = parseDate(dataCompraStr);
          
          const diffTime = Math.abs(dataSolicitacao.getTime() - dataCompra.getTime());
          diasAteDistrato = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          if (diasAteDistrato <= 7) {
            classificacaoDistrato = 'Dentro do prazo (0-7 dias)';
          } else if (diasAteDistrato <= 30) {
            classificacaoDistrato = 'Fora do prazo curto (8-30 dias)';
          } else {
            classificacaoDistrato = 'Fora do prazo longo (31+ dias)';
          }
        } catch (e) {
          console.warn("Erro ao calcular datas para o CPF", cpf);
        }

        // Função simples de hash para garantir unicidade da linha
        const hashString = (str: string) => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          return Math.abs(hash).toString(36);
        };

        // Usa CPF + Hash da linha como ID único para evitar sobrescrever registros diferentes da mesma pessoa
        // e permitir que a mesma pessoa tenha múltiplos cancelamentos no mesmo dia, desde que os dados sejam diferentes.
        const rowString = JSON.stringify(row);
        const docId = `${cpf}_${hashString(rowString)}`;
        const docRef = doc(db, 'cancelamentos', docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          duplicates.push(cpf);
        } else {
          const empreendimentosRaw = findKey(row, ['empreendimento']);
          const motivosSecundariosRaw = findKey(row, ['além do motivo principal', 'fatores também influenciaram']);
          
          const keys = Object.keys(row);
          const salaVendasRaw = keys.length > 14 ? row[keys[14]] : findKey(row, ['sala de vendas', 'sala']);

          let qtdCotasRaw = findKey(row, ['quantas cotas', 'quantidade de cotas']);
          let qtdCotas = 1;
          if (typeof qtdCotasRaw === 'string') {
            const match = qtdCotasRaw.match(/\d+/);
            if (match) {
              qtdCotas = parseInt(match[0]);
            }
          } else if (typeof qtdCotasRaw === 'number') {
            qtdCotas = qtdCotasRaw;
          }

          // Prepara os dados com o mapeamento completo
          const now = new Date().toISOString();
          
          const protocoloRaw = findKey(row, ['protocolo', 'número de protocolo']);
          const protocolo = String(protocoloRaw || `PRT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`);

          const cancelamentoData = {
            protocolo,
            cpf: String(cpf),
            timestamp: dataSolicitacao.toISOString(),
            nomeCompleto: String(findKey(row, ['nome completo', 'nome do titular', 'nome']) || 'Não informado'),
            email: String(findKey(row, ['email', 'e-mail', 'correio eletrônico']) || ''),
            telefone: String(findKey(row, ['telefone', 'whatsapp', 'celular']) || ''),
            dataCompra: dataCompra && !isNaN(dataCompra.getTime()) 
              ? `${dataCompra.getFullYear()}-${String(dataCompra.getMonth() + 1).padStart(2, '0')}-${String(dataCompra.getDate()).padStart(2, '0')}`
              : (dataCompraStr ? String(dataCompraStr) : ''),
            empreendimentos: typeof empreendimentosRaw === 'string' ? empreendimentosRaw.split(',').map(s => s.trim()) : [],
            qtdCotas,
            motivoPrincipal: String(findKey(row, ['principal motivo', 'motivo principal']) || ''),
            motivosSecundarios: typeof motivosSecundariosRaw === 'string' ? motivosSecundariosRaw.split(',').map(s => s.trim()) : [],
            experienciaComercial: String(findKey(row, ['experiência com a nossa equipe', 'experiência comercial']) || ''),
            satisfacaoComercial: parseInt(findKey(row, ['grau de satisfação', 'satisfação geral'])) || 0,
            possibilidadeRecompra: String(findKey(row, ['possibilidade de adquirir', 'recompra']) || ''),
            auditorLeuClausulas: String(findKey(row, ['checklist', 'cláusulas'])).toLowerCase().includes('sim'),
            sugestoesMelhorias: String(findKey(row, ['sugestões', 'melhorias']) || ''),
            observacoes: String(findKey(row, ['observações', 'obs', 'comentários']) || ''),
            salaVendas: String(salaVendasRaw || ''),
            nomeVendedor: String(findKey(row, ['nome do vendedor', 'vendedor']) || ''),
            nomeGerente: String(findKey(row, ['nome do negociador', 'gerente']) || ''),
            diasAteDistrato,
            classificacaoDistrato: String(classificacaoDistrato),
            createdAt: now,
            updatedAt: now,
          };

          batch.set(docRef, cancelamentoData);
          successCount++;
          operationsInBatch++;

          // Se atingir o limite do batch, commita e cria um novo
          if (operationsInBatch === 490) {
            await batch.commit();
            batch = writeBatch(db);
            operationsInBatch = 0;
          }
        }
      }

      if (operationsInBatch > 0) {
        await batch.commit();
      }

      setImportResult({
        success: successCount,
        duplicates,
        errors
      });
      
      if (successCount === 0 && duplicates.length === 0) {
        alert(`Nenhum dado foi importado. Verifique se a planilha possui a coluna de CPF/CNPJ. Erros: ${errors.length > 0 ? errors[0] : 'Nenhum erro específico'}`);
      } else if (successCount > 0) {
        fetchCancelamentos();
      }
    } catch (error: any) {
      console.error("Erro na importação:", error);
      alert(`Ocorreu um erro ao processar os dados: ${error.message || error}`);
    } finally {
      setImporting(false);
      setSyncing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processCSVData(results.data as any[]);
          // Reseta o input
          event.target.value = '';
        },
        error: (error) => {
          console.error("Erro no PapaParse:", error);
          alert("Erro ao ler o arquivo CSV.");
          setImporting(false);
        }
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        await processCSVData(jsonData);
        event.target.value = '';
      } catch (error) {
        console.error("Erro ao ler arquivo Excel:", error);
        alert("Erro ao ler o arquivo Excel.");
        setImporting(false);
      }
    } else {
      alert("Formato de arquivo não suportado. Por favor, envie um arquivo .csv ou .xlsx");
      setImporting(false);
      event.target.value = '';
    }
  };

  const handleSyncSheet = async () => {
    setSyncing(true);
    setImportResult(null);
    try {
      // Fetch the Google Sheets URL from settings
      const configDoc = await getDoc(doc(db, 'settings', 'general'));
      let sheetsUrl = '';
      if (configDoc.exists()) {
        sheetsUrl = configDoc.data().googleSheetsUrl;
      }

      if (!sheetsUrl) {
        alert("URL da planilha não configurada. Por favor, configure a URL na página de Configurações.");
        setSyncing(false);
        return;
      }

      // Encode the URL to pass it safely as a query parameter
      const response = await fetch(`/api/sync-sheet?url=${encodeURIComponent(sheetsUrl)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Erro HTTP ${response.status}`);
      }
      
      const csvText = await response.text();
      
      // Verifica se retornou HTML (página de login do Google ou erro)
      if (csvText.trim().toLowerCase().startsWith('<!doctype html>')) {
        alert("Erro: A planilha parece estar privada. Por favor, altere o compartilhamento no Google Sheets para 'Qualquer pessoa com o link pode ver'.");
        setSyncing(false);
        return;
      }

      await new Promise<void>((resolve, reject) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            try {
              await processCSVData(results.data as any[]);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          error: (error) => {
            console.error("Erro no PapaParse:", error);
            reject(new Error("Erro ao ler o formato da planilha."));
          }
        });
      });
    } catch (error: any) {
      console.error("Erro no handleSyncSheet:", error);
      alert(`Erro ao conectar com a planilha Google: ${error.message || error}`);
      setSyncing(false);
    }
  };

  const handleOpenEmailModal = (target: 'single' | 'bulk', item?: Cancelamento) => {
    setEmailTarget(target);
    if (item) setSelectedItem(item);
    setEmailStep('select');
    setEmailError(null);
    setSelectedRecipients([]);
    setIsEmailModalOpen(true);
  };

  const generateEmailHtml = (data: Cancelamento[]) => {
    const formatDate = (ts: any) => {
      if (!ts) return '-';
      try {
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
      } catch (e) {
        return '-';
      }
    };

    const formatCpf = (val: string) => formatCpfCnpj(val);

    if (data.length === 1) {
      const item = data[0];
      return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 700px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <!-- Header -->
          <div style="background-color: #5C2C3E; color: #ffffff; padding: 30px; text-align: left;">
            <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Relatório de Distrato</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.8; font-size: 14px;">Laghetto Golden - Análise de Cancelamento</p>
          </div>

          <div style="padding: 30px;">
            <!-- Status Badge -->
            <div style="text-align: right; margin-bottom: 20px;">
              <span style="background-color: #fee2e2; color: #b91c1c; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #fecaca;">
                Distrato Solicitado
              </span>
            </div>

            <!-- Seção: Dados do Cliente -->
            <div style="margin-bottom: 30px; background-color: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #f3f4f6;">
              <h3 style="margin: 0 0 15px 0; color: #5C2C3E; font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Dados do Cliente</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600; width: 40%;">Nome Completo</td>
                  <td style="padding: 6px 0; color: #111827; font-weight: 500;">${item.nomeCompleto || 'Não informado'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600;">CPF/CNPJ</td>
                  <td style="padding: 6px 0; color: #111827; font-family: monospace;">${formatCpf(item.cpf)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600;">Telefone</td>
                  <td style="padding: 6px 0; color: #111827;">${item.telefone || 'Não informado'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600;">E-mail</td>
                  <td style="padding: 6px 0; color: #111827;">${item.email || 'Não informado'}</td>
                </tr>
              </table>
            </div>

            <!-- Seção: Detalhes da Compra -->
            <div style="margin-bottom: 30px; background-color: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #f3f4f6;">
              <h3 style="margin: 0 0 15px 0; color: #5C2C3E; font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Detalhes da Compra</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600; width: 40%;">Data da Compra</td>
                  <td style="padding: 6px 0; color: #111827;">${item.dataCompra || 'Não informada'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600;">Empreendimento(s)</td>
                  <td style="padding: 6px 0; color: #111827;">${Array.isArray(item.empreendimentos) ? item.empreendimentos.join(', ') : (item.empreendimento || 'Não informado')}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600;">Sala de Vendas</td>
                  <td style="padding: 6px 0; color: #111827;">${item.salaVendas || 'Não informada'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600;">Vendedor</td>
                  <td style="padding: 6px 0; color: #111827;">${item.nomeVendedor || 'Não informado'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600;">Qtd. Cotas</td>
                  <td style="padding: 6px 0; color: #111827;">${item.qtdCotas || '1'}</td>
                </tr>
              </table>
            </div>

            <!-- Seção: Informações do Distrato -->
            <div style="margin-bottom: 30px; background-color: #fef2f2; padding: 20px; border-radius: 8px; border: 1px solid #fee2e2;">
              <h3 style="margin: 0 0 15px 0; color: #991b1b; font-size: 18px; border-bottom: 1px solid #fecaca; padding-bottom: 8px;">Informações do Distrato</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #991b1b; font-size: 12px; text-transform: uppercase; font-weight: 600; width: 40%;">Data da Solicitação</td>
                  <td style="padding: 6px 0; color: #111827; font-weight: 500;">${formatDate(item.timestamp)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #991b1b; font-size: 12px; text-transform: uppercase; font-weight: 600;">Dias até Cancelar</td>
                  <td style="padding: 6px 0; color: #111827;">${item.diasAteDistrato} dias</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #991b1b; font-size: 12px; text-transform: uppercase; font-weight: 600;">Classificação</td>
                  <td style="padding: 6px 0; color: #111827;">${item.classificacaoDistrato || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #991b1b; font-size: 12px; text-transform: uppercase; font-weight: 600;">Motivo Principal</td>
                  <td style="padding: 10px; color: #111827; background-color: #ffffff; border: 1px solid #fecaca; border-radius: 4px; margin-top: 5px; display: block;">
                    ${item.motivoPrincipal || 'Não informado'}
                  </td>
                </tr>
              </table>
            </div>

            <!-- Seção: Avaliação Comercial -->
            <div style="margin-bottom: 30px; background-color: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #f3f4f6;">
              <h3 style="margin: 0 0 15px 0; color: #5C2C3E; font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Avaliação Comercial</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600; width: 40%;">Satisfação</td>
                  <td style="padding: 6px 0; color: #111827; font-weight: bold;">${item.satisfacaoComercial || '0'} / 5</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600;">Leu Cláusulas?</td>
                  <td style="padding: 6px 0; color: #111827;">${item.auditorLeuClausulas ? 'Sim' : 'Não'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600;">Recompra Futura?</td>
                  <td style="padding: 6px 0; color: #111827;">${item.possibilidadeRecompra || 'Não informado'}</td>
                </tr>
              </table>
              
              ${item.experienciaComercial ? `
                <div style="margin-top: 15px;">
                  <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600;">Experiência com a Equipe</p>
                  <p style="margin: 0; color: #4b5563; font-style: italic; font-size: 14px; background-color: #ffffff; padding: 10px; border-radius: 4px; border: 1px solid #e5e7eb;">
                    "${item.experienciaComercial}"
                  </p>
                </div>
              ` : ''}
            </div>

            ${item.observacoes ? `
              <div style="margin-bottom: 30px; background-color: #fffbeb; padding: 20px; border-radius: 8px; border: 1px solid #fef3c7;">
                <h3 style="margin: 0 0 10px 0; color: #92400e; font-size: 18px;">Observações Adicionais</h3>
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                  ${item.observacoes}
                </p>
              </div>
            ` : ''}
          </div>

          <!-- Footer -->
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #6b7280;">
              Este é um relatório automático gerado pelo sistema <strong>Laghetto Golden</strong>.
            </p>
            <p style="margin: 5px 0 0 0; font-size: 11px; color: #9ca3af;">
              Gerado em ${new Date().toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      `;
    }

    // Bulk Report (Table)
    const rows = data.map(item => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 10px; font-size: 13px; color: #111827;">${item.nomeCompleto || '-'}</td>
        <td style="padding: 12px 10px; font-size: 13px; color: #4b5563; font-family: monospace;">${formatCpf(item.cpf)}</td>
        <td style="padding: 12px 10px; font-size: 13px; color: #4b5563;">${Array.isArray(item.empreendimentos) ? item.empreendimentos[0] : item.empreendimento || '-'}</td>
        <td style="padding: 12px 10px; font-size: 13px; color: #4b5563;">${item.diasAteDistrato !== undefined ? item.diasAteDistrato + ' dias' : '-'}</td>
        <td style="padding: 12px 10px; font-size: 13px; color: #4b5563;">${formatDate(item.timestamp)}</td>
      </tr>
    `).join('');

    return `
      <div style="font-family: sans-serif; color: #333; max-width: 900px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #5C2C3E; color: white; padding: 20px;">
          <h2 style="margin: 0; font-size: 20px;">Relatório Consolidado de Cancelamentos</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.8; font-size: 13px;">Resumo das ocorrências registradas no sistema</p>
        </div>
        
        <div style="padding: 20px;">
          <p style="margin-bottom: 20px; font-size: 14px; color: #666;">
            Total de registros: <strong>${data.length}</strong>
          </p>
          
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f8f9fa; text-align: left; border-bottom: 2px solid #5C2C3E;">
                <th style="padding: 12px 10px; font-size: 12px; color: #5C2C3E; text-transform: uppercase;">Nome</th>
                <th style="padding: 12px 10px; font-size: 12px; color: #5C2C3E; text-transform: uppercase;">CPF</th>
                <th style="padding: 12px 10px; font-size: 12px; color: #5C2C3E; text-transform: uppercase;">Empreendimento</th>
                <th style="padding: 12px 10px; font-size: 12px; color: #5C2C3E; text-transform: uppercase;">Prazo</th>
                <th style="padding: 12px 10px; font-size: 12px; color: #5C2C3E; text-transform: uppercase;">Data</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
        
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #eee;">
          <p style="margin: 0; font-size: 11px; color: #999;">
            Relatório gerado automaticamente pelo sistema Laghetto Golden em ${new Date().toLocaleString('pt-BR')}.
          </p>
        </div>
      </div>
    `;
  };

  const handleConfirmSendEmail = async () => {
    if (!selectedRecipients || selectedRecipients.length === 0) {
      setEmailError("Selecione pelo menos um destinatário.");
      return;
    }
    
    setEmailStep('sending');
    setEmailError(null);

    // Pequeno delay para garantir que o estado 'sending' seja renderizado
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const dataToSend = emailTarget === 'single' && selectedItem ? [selectedItem] : filteredCancelamentos;
      
      if (dataToSend.length === 0) {
        throw new Error("Não há dados para enviar.");
      }

      const htmlContent = generateEmailHtml(dataToSend);
      const subject = emailTarget === 'single' 
        ? `Relatório de Cancelamento: ${selectedItem?.nomeCompleto}`
        : `Relatório Consolidado de Cancelamentos - ${new Date().toLocaleDateString('pt-BR')}`;

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedRecipients.join(', '),
          subject,
          html: htmlContent
        })
      });

      const result = await response.json();

      if (response.ok) {
        setEmailStep('success');
      } else {
        throw new Error(result.error || "Falha ao enviar e-mail");
      }
    } catch (error: any) {
      console.error("Erro ao enviar e-mail:", error);
      setEmailError(error.message || "Erro inesperado ao enviar e-mail.");
      setEmailStep('error');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Relatórios de Cancelamentos</h1>
          <p className="text-gray-500 mt-1">{filteredCancelamentos.length} registro(s) encontrado(s)</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <button 
            onClick={() => setShowClearConfirm(true)}
            disabled={syncing || importing}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg cursor-pointer transition-colors shadow-sm disabled:opacity-50 text-sm"
          >
            <Trash2 size={18} />
            <span className="font-medium whitespace-nowrap">Limpar Banco</span>
          </button>

          <button 
            onClick={handleSyncSheet}
            disabled={syncing || importing}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-white border border-[#5C2C3E] text-[#5C2C3E] hover:bg-gray-50 px-3 py-2 rounded-lg cursor-pointer transition-colors shadow-sm disabled:opacity-50 text-sm"
          >
            <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
            <span className="font-medium whitespace-nowrap">{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
          
          <label className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-[#5C2C3E] hover:bg-[#4a2332] text-white px-3 py-2 rounded-lg cursor-pointer transition-colors shadow-sm disabled:opacity-50 text-sm">
            <Upload size={18} />
            <span className="font-medium whitespace-nowrap">{importing ? 'Processando...' : 'Importar'}</span>
            <input 
              type="file" 
              accept=".csv, .xlsx, .xls" 
              className="hidden" 
              onChange={handleFileUpload}
              disabled={importing || syncing}
            />
          </label>
        </div>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Limpar Banco de Dados</h3>
            <p className="text-gray-600 mb-6">
              Tem certeza que deseja apagar TODOS os dados de cancelamentos? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleClearDatabase}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors"
              >
                Sim, apagar tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col gap-4 mb-6">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome, CPF, vendedor ou sala..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5C2C3E] focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveFilter(activeFilter === 'periodo' ? null : 'periodo')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${
                activeFilter === 'periodo' ? 'border-black bg-white text-black ring-1 ring-black' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Calendar size={16} />
              <span className="font-medium">Registro</span>
            </button>

            <button
              onClick={() => setActiveFilter(activeFilter === 'compra' ? null : 'compra')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${
                activeFilter === 'compra' ? 'border-black bg-white text-black ring-1 ring-black' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Calendar size={16} />
              <span className="font-medium">Compra</span>
            </button>

            <button
              onClick={() => setActiveFilter(activeFilter === 'empreendimento' ? null : 'empreendimento')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${
                activeFilter === 'empreendimento' ? 'border-black bg-white text-black ring-1 ring-black' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter size={16} />
              <span className="font-medium">Empreend.</span>
            </button>

            <button
              onClick={() => setActiveFilter(activeFilter === 'sala' ? null : 'sala')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${
                activeFilter === 'sala' ? 'border-black bg-white text-black ring-1 ring-black' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Store size={16} />
              <span className="font-medium">Sala</span>
            </button>

            <button
              onClick={() => setActiveFilter(activeFilter === 'prazo' ? null : 'prazo')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${
                activeFilter === 'prazo' ? 'border-black bg-white text-black ring-1 ring-black' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Clock size={16} />
              <span className="font-medium">Prazo {filterPrazoDistrato ? `(1)` : ''}</span>
            </button>

            <div className="flex gap-2 ml-auto w-full md:w-auto mt-2 md:mt-0">
              <button
                onClick={() => handleOpenEmailModal('bulk')}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#5C2C3E] hover:bg-[#4a2332] text-white px-4 py-2 rounded-lg transition-colors shadow-sm text-sm"
              >
                <Mail size={18} />
                <span className="font-medium">E-mail</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors shadow-sm text-sm"
              >
                <Download size={18} />
                <span className="font-medium">CSV</span>
              </button>
            </div>
          </div>
        </div>

        {activeFilter && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 animate-in fade-in slide-in-from-top-2 duration-200">
            {activeFilter === 'periodo' && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-4">Filtrar por Período de Registro</p>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 min-w-[80px]">Data inicial:</span>
                    <input
                      type="date"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5C2C3E]"
                      value={filterPeriod.start}
                      onChange={(e) => setFilterPeriod({ ...filterPeriod, start: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 min-w-[80px]">Data final:</span>
                    <input
                      type="date"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5C2C3E]"
                      value={filterPeriod.end}
                      onChange={(e) => setFilterPeriod({ ...filterPeriod, end: e.target.value })}
                    />
                  </div>
                  {(filterPeriod.start || filterPeriod.end) && (
                    <button
                      onClick={() => setFilterPeriod({ start: '', end: '' })}
                      className="text-sm text-[#5C2C3E] hover:underline font-medium"
                    >
                      Limpar filtro
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeFilter === 'compra' && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-4">Filtrar por Período de Compra</p>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 min-w-[80px]">Data inicial:</span>
                    <input
                      type="date"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5C2C3E]"
                      value={filterCompraPeriod.start}
                      onChange={(e) => setFilterCompraPeriod({ ...filterCompraPeriod, start: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 min-w-[80px]">Data final:</span>
                    <input
                      type="date"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5C2C3E]"
                      value={filterCompraPeriod.end}
                      onChange={(e) => setFilterCompraPeriod({ ...filterCompraPeriod, end: e.target.value })}
                    />
                  </div>
                  {(filterCompraPeriod.start || filterCompraPeriod.end) && (
                    <button
                      onClick={() => setFilterCompraPeriod({ start: '', end: '' })}
                      className="text-sm text-[#5C2C3E] hover:underline font-medium"
                    >
                      Limpar filtro
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeFilter === 'empreendimento' && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-4">Filtrar por Empreendimento</p>
                <div className="flex flex-wrap gap-2">
                  {uniqueEmpreendimentos.map(emp => (
                    <button
                      key={emp}
                      onClick={() => {
                        if (filterEmpreendimento.includes(emp)) {
                          setFilterEmpreendimento(filterEmpreendimento.filter(e => e !== emp));
                        } else {
                          setFilterEmpreendimento([...filterEmpreendimento, emp]);
                        }
                      }}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        filterEmpreendimento.includes(emp)
                          ? 'bg-[#5C2C3E] text-white border-[#5C2C3E]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#5C2C3E] hover:text-[#5C2C3E]'
                      }`}
                    >
                      {emp}
                    </button>
                  ))}
                  {filterEmpreendimento.length > 0 && (
                    <button
                      onClick={() => setFilterEmpreendimento([])}
                      className="text-sm text-[#5C2C3E] hover:underline font-medium ml-2"
                    >
                      Limpar filtro
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeFilter === 'sala' && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-4">Filtrar por Sala de Vendas</p>
                <div className="flex flex-wrap gap-2">
                  {uniqueSalas.map(sala => (
                    <button
                      key={sala}
                      onClick={() => {
                        if (filterSalaVendas.includes(sala)) {
                          setFilterSalaVendas(filterSalaVendas.filter(s => s !== sala));
                        } else {
                          setFilterSalaVendas([...filterSalaVendas, sala]);
                        }
                      }}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        filterSalaVendas.includes(sala)
                          ? 'bg-[#5C2C3E] text-white border-[#5C2C3E]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#5C2C3E] hover:text-[#5C2C3E]'
                      }`}
                    >
                      {sala}
                    </button>
                  ))}
                  {filterSalaVendas.length > 0 && (
                    <button
                      onClick={() => setFilterSalaVendas([])}
                      className="text-sm text-[#5C2C3E] hover:underline font-medium ml-2"
                    >
                      Limpar filtro
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeFilter === 'prazo' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-semibold text-gray-700">Filtrar por Prazo de Distrato</p>
                  {filterPrazoDistrato && (
                    <button
                      onClick={() => setFilterPrazoDistrato(null)}
                      className="text-sm text-[#5C2C3E] hover:underline font-medium"
                    >
                      Limpar filtro
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilterPrazoDistrato(filterPrazoDistrato === 'dentro' ? null : 'dentro')}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-medium border transition-all ${
                      filterPrazoDistrato === 'dentro'
                        ? 'bg-green-100 text-green-800 border-green-300 ring-2 ring-green-500'
                        : 'bg-green-50 text-green-700 border-green-100 hover:border-green-300'
                    }`}
                  >
                    0–7 dias
                  </button>
                  <button
                    onClick={() => setFilterPrazoDistrato(filterPrazoDistrato === 'curto' ? null : 'curto')}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-medium border transition-all ${
                      filterPrazoDistrato === 'curto'
                        ? 'bg-yellow-100 text-yellow-800 border-yellow-300 ring-2 ring-yellow-500'
                        : 'bg-yellow-50 text-yellow-700 border-yellow-100 hover:border-yellow-300'
                    }`}
                  >
                    8–30 dias
                  </button>
                  <button
                    onClick={() => setFilterPrazoDistrato(filterPrazoDistrato === 'longo' ? null : 'longo')}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-medium border transition-all ${
                      filterPrazoDistrato === 'longo'
                        ? 'bg-red-100 text-red-800 border-red-300 ring-2 ring-red-500'
                        : 'bg-red-50 text-red-700 border-red-100 hover:border-red-300'
                    }`}
                  >
                    31+ dias
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {importResult && (
        <div className="mb-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="text-green-500" />
            Resultado da Importação
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-100">
              <p className="text-sm text-green-800 font-medium">Novos Registros</p>
              <p className="text-2xl font-bold text-green-600">{importResult.success}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
              <p className="text-sm text-yellow-800 font-medium">Duplicados (Ignorados)</p>
              <p className="text-2xl font-bold text-yellow-600">{importResult.duplicates.length}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-100">
              <p className="text-sm text-red-800 font-medium">Erros de Formatação</p>
              <p className="text-2xl font-bold text-red-600">{importResult.errors.length}</p>
            </div>
          </div>
          
          {importResult.duplicates.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50/50 border border-yellow-200 rounded-lg">
              <div className="flex gap-3">
                <AlertCircle className="text-yellow-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-sm font-medium text-yellow-800 mb-1">
                    Atenção: Alguns CPFs/CNPJs já constam na base de dados.
                  </p>
                  <p className="text-sm text-yellow-700">
                    A solicitação de cancelamento para estes clientes já foi registrada. O cliente deve aguardar o contato do setor de Pós-vendas.
                  </p>
                  <div className="mt-2 max-h-24 overflow-y-auto text-xs text-yellow-600 font-mono bg-white/50 p-2 rounded border border-yellow-100">
                    {importResult.duplicates.join(', ')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 w-10">
                  <input type="checkbox" className="rounded border-gray-300 text-[#5C2C3E] focus:ring-[#5C2C3E]" />
                </th>
                <th className="p-4 text-sm font-semibold text-gray-600">Protocolo</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Nome</th>
                <th className="p-4 text-sm font-semibold text-gray-600">CPF</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Vendedor</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Empreend.</th>
                <th className="p-4 text-sm font-semibold text-gray-600 text-center">Satisf.</th>
                <th className="p-4 text-sm font-semibold text-gray-600 text-center">Distrato</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Data</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    <div className="flex justify-center mb-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5C2C3E]"></div>
                    </div>
                    Carregando dados...
                  </td>
                </tr>
              ) : filteredCancelamentos.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    <FileText className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                    <p>Nenhum cancelamento encontrado.</p>
                    <p className="text-sm mt-1">Importe uma planilha CSV ou Excel para começar.</p>
                  </td>
                </tr>
              ) : (
                filteredCancelamentos.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <input type="checkbox" className="rounded border-gray-300 text-[#5C2C3E] focus:ring-[#5C2C3E]" />
                    </td>
                    <td className="p-4 text-sm text-gray-600 font-mono font-medium">{item.protocolo || '-'}</td>
                    <td className="p-4 text-sm text-gray-900 font-medium">{item.nomeCompleto}</td>
                    <td className="p-4 text-sm text-gray-600 font-mono">{formatCpfCnpj(item.cpf)}</td>
                    <td className="p-4 text-sm text-gray-600">{item.nomeVendedor || '-'}</td>
                    <td className="p-4 text-sm text-gray-600">{Array.isArray(item.empreendimentos) ? item.empreendimentos[0] : item.empreendimento || '-'}</td>
                    <td className="p-4 text-sm text-gray-600 text-center">
                      {item.satisfacaoComercial ? `${item.satisfacaoComercial}/5` : '-'}
                    </td>
                    <td className="p-4 text-sm text-center">
                      {item.diasAteDistrato !== undefined ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.diasAteDistrato <= 7 ? 'bg-green-100 text-green-700' :
                          item.diasAteDistrato <= 30 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {item.diasAteDistrato} dias
                        </span>
                      ) : '-'}
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {(() => {
                        const d = new Date(item.timestamp);
                        return isNaN(d.getTime()) ? 'Data Inválida' : d.toLocaleDateString('pt-BR');
                      })()}
                    </td>
                    <td className="p-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setSelectedItem(item)}
                          className="p-1.5 text-gray-400 hover:text-[#5C2C3E] transition-colors"
                          title="Ver detalhes"
                        >
                          <FileText size={18} />
                        </button>
                        <button 
                          onClick={() => handleOpenEmailModal('single', item)}
                          className="p-1.5 text-gray-400 hover:text-[#5C2C3E] transition-colors"
                          title="Enviar e-mail"
                        >
                          <Mail size={18} />
                        </button>
                        <button 
                          onClick={() => handleDownloadPDF(item)}
                          className="p-1.5 text-gray-400 hover:text-[#5C2C3E] transition-colors"
                          title="Baixar PDF"
                        >
                          <Download size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-gray-50 rounded-2xl w-full max-w-4xl shadow-2xl my-8 flex flex-col max-h-[90vh]">
            
            {/* Header do Modal */}
            <div className="bg-[#5C2C3E] text-white p-6 rounded-t-2xl flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-2xl font-bold">Relatório de Distrato</h2>
                <p className="text-white/80 text-sm mt-1">
                  Gerado em {(() => {
                    const d = new Date();
                    return d.toLocaleDateString('pt-BR');
                  })()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download size={16} />
                  Baixar PDF
                </button>
                <button 
                  onClick={() => handleOpenEmailModal('single', selectedItem)}
                  className="flex items-center gap-2 bg-white text-[#5C2C3E] hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Mail size={16} />
                  Enviar por E-mail
                </button>
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors ml-2"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Conteúdo do Relatório (Capturado pelo html2canvas) */}
            <div className="p-8 overflow-y-auto flex-1" id="relatorio-content">
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                
                {/* Header do PDF */}
                <div className="flex justify-between items-start border-b border-gray-100 pb-6 mb-6">
                  <div>
                    <h1 className="text-3xl font-bold text-[#5C2C3E] tracking-tight">Laghetto Golden</h1>
                    <p className="text-gray-500 font-medium mt-1">Análise de Cancelamentos</p>
                    {selectedItem.protocolo && (
                      <p className="text-sm font-mono text-gray-600 mt-2 bg-gray-100 inline-block px-2 py-1 rounded">
                        Protocolo: {selectedItem.protocolo}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400 font-medium uppercase tracking-wider">Status</p>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-red-50 text-red-700 border border-red-100 mt-1">
                      DISTRATO SOLICITADO
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Bloco: Dados do Cliente */}
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 mb-4 text-[#5C2C3E]">
                      <User size={20} />
                      <h3 className="font-bold text-lg">Dados do Cliente</h3>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Nome Completo</p>
                        <p className="text-gray-900 font-medium">{selectedItem.nomeCompleto}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">CPF/CNPJ</p>
                          <p className="text-gray-900 font-mono">{formatCpfCnpj(selectedItem.cpf)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Telefone</p>
                          <p className="text-gray-900">{selectedItem.telefone || 'Não informado'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bloco: Detalhes da Compra */}
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 mb-4 text-[#5C2C3E]">
                      <Building2 size={20} />
                      <h3 className="font-bold text-lg">Detalhes da Compra</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Data da Compra</p>
                          <p className="text-gray-900">
                            {selectedItem.dataCompra 
                              ? (selectedItem.dataCompra.includes('-') 
                                  ? selectedItem.dataCompra.split('-').reverse().join('/') 
                                  : selectedItem.dataCompra) 
                              : 'Não informada'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Qtd. Cotas</p>
                          <p className="text-gray-900 font-medium">{selectedItem.qtdCotas}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Empreendimento(s)</p>
                        <p className="text-gray-900">{selectedItem.empreendimentos?.join(', ') || 'Não informado'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Sala de Vendas</p>
                          <p className="text-gray-900">{selectedItem.salaVendas || 'Não informada'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Vendedor</p>
                          <p className="text-gray-900">{selectedItem.nomeVendedor || 'Não informado'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bloco: Informações do Distrato */}
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 md:col-span-2">
                    <div className="flex items-center gap-2 mb-4 text-[#5C2C3E]">
                      <Calendar size={20} />
                      <h3 className="font-bold text-lg">Informações do Distrato</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Data da Solicitação</p>
                        <p className="text-gray-900 font-medium">{(() => {
                          const d = new Date(selectedItem.timestamp);
                          return isNaN(d.getTime()) ? 'Data Inválida' : d.toLocaleDateString('pt-BR');
                        })()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Dias até Cancelar</p>
                        <p className="text-gray-900 font-medium">{selectedItem.diasAteDistrato} dias</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Classificação</p>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                          {selectedItem.classificacaoDistrato}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-4 border-t border-gray-200 pt-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">Motivo Principal</p>
                        <p className="text-gray-900 font-medium bg-white p-3 rounded-lg border border-gray-200">
                          {selectedItem.motivoPrincipal || 'Não informado'}
                        </p>
                      </div>
                      
                      {selectedItem.motivosSecundarios && selectedItem.motivosSecundarios.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">Motivos Secundários</p>
                          <ul className="list-disc list-inside text-gray-700 bg-white p-3 rounded-lg border border-gray-200 space-y-1">
                            {selectedItem.motivosSecundarios.map((m: string, i: number) => (
                              <li key={i} className="text-sm">{m}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bloco: Avaliação Comercial */}
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 md:col-span-2">
                    <div className="flex items-center gap-2 mb-4 text-[#5C2C3E]">
                      <MessageSquare size={20} />
                      <h3 className="font-bold text-lg">Avaliação Comercial</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Satisfação</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-2xl font-bold text-[#5C2C3E]">{selectedItem.satisfacaoComercial}</span>
                          <span className="text-sm text-gray-500">/ 5</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Leu Cláusulas?</p>
                        <p className="text-gray-900 font-medium mt-1">
                          {selectedItem.auditorLeuClausulas ? 'Sim' : 'Não'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Recompra Futura?</p>
                        <p className="text-gray-900 font-medium mt-1">
                          {selectedItem.possibilidadeRecompra || 'Não informado'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 border-t border-gray-200 pt-4">
                      {selectedItem.experienciaComercial && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">Experiência com a Equipe</p>
                          <p className="text-gray-700 text-sm bg-white p-3 rounded-lg border border-gray-200 italic">
                            "{selectedItem.experienciaComercial}"
                          </p>
                        </div>
                      )}
                      
                      {selectedItem.sugestoesMelhorias && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">Sugestões de Melhoria</p>
                          <p className="text-gray-700 text-sm bg-white p-3 rounded-lg border border-gray-200 italic">
                            "{selectedItem.sugestoesMelhorias}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Envio de E-mail */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            
            {/* Header */}
            <div className="bg-[#5C2C3E] text-white p-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Mail className="w-6 h-6" />
                <h3 className="text-xl font-bold">Enviar Relatório por E-mail</h3>
              </div>
              <button onClick={() => setIsEmailModalOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {emailStep === 'select' && (
                <div className="space-y-4">
                  <p className="text-gray-600">Selecione os destinatários que devem receber este relatório:</p>
                  <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                    {emailRecipientsList.length > 0 ? (
                      emailRecipientsList.map(recipient => (
                        <label key={recipient.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            className="w-5 h-5 rounded border-gray-300 text-[#5C2C3E] focus:ring-[#5C2C3E]"
                            checked={selectedRecipients.includes(recipient.email)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRecipients([...selectedRecipients, recipient.email]);
                              } else {
                                setSelectedRecipients(selectedRecipients.filter(email => email !== recipient.email));
                              }
                            }}
                          />
                          <div>
                            <p className="font-medium text-gray-900">{recipient.name || 'Sem nome'}</p>
                            <p className="text-sm text-gray-500">{recipient.email}</p>
                          </div>
                        </label>
                      ))
                    ) : (
                      <div className="p-8 text-center text-gray-500 italic">
                        Nenhum destinatário ativo encontrado. <br/>
                        <a href="/destinatarios" className="text-[#5C2C3E] underline mt-2 inline-block">Cadastrar destinatários</a>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setIsEmailModalOpen(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={selectedRecipients.length === 0}
                      onClick={() => setEmailStep('summary')}
                      className="bg-[#5C2C3E] text-white px-6 py-2 rounded-lg hover:bg-[#4a2332] transition-colors shadow-sm disabled:opacity-50 font-medium"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}

              {emailStep === 'summary' && (
                <div className="space-y-6">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <h4 className="font-bold text-gray-900 mb-2">Resumo do Envio</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex justify-between">
                        <span>Tipo de Relatório:</span>
                        <span className="font-medium text-gray-900">{emailTarget === 'single' ? 'Ocorrência Individual' : 'Relatório Filtrado'}</span>
                      </li>
                      <li className="flex justify-between">
                        <span>Registros:</span>
                        <span className="font-medium text-gray-900">{emailTarget === 'single' ? '1' : filteredCancelamentos.length}</span>
                      </li>
                      <li className="flex justify-between">
                        <span>Destinatários:</span>
                        <span className="font-medium text-gray-900">{selectedRecipients.length}</span>
                      </li>
                    </ul>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setEmailStep('select')}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleConfirmSendEmail}
                      className="bg-[#5C2C3E] text-white px-6 py-2 rounded-lg hover:bg-[#4a2332] transition-colors shadow-sm font-medium flex items-center gap-2"
                    >
                      Confirmar e Enviar
                    </button>
                  </div>
                </div>
              )}

              {emailStep === 'sending' && (
                <div className="py-12 flex flex-col items-center justify-center space-y-4">
                  <div className="w-12 h-12 border-4 border-[#5C2C3E]/20 border-t-[#5C2C3E] rounded-full animate-spin" />
                  <p className="text-lg font-medium text-gray-900">Enviando e-mails...</p>
                  <p className="text-sm text-gray-500">Isso pode levar alguns segundos.</p>
                </div>
              )}

              {emailStep === 'error' && (
                <div className="py-8 flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                    <AlertCircle size={32} />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900">Erro no Envio</h4>
                  <p className="text-red-600 text-center px-4">{emailError || "Ocorreu um erro ao tentar enviar o e-mail."}</p>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => setEmailStep('summary')}
                      className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                    >
                      Tentar Novamente
                    </button>
                    <button
                      onClick={() => setIsEmailModalOpen(false)}
                      className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}

              {emailStep === 'success' && (
                <div className="py-12 flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-300">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <CheckCircle2 size={32} />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900">E-mails enviados!</h4>
                  <p className="text-gray-600 text-center">O relatório foi enviado com sucesso para todos os destinatários selecionados.</p>
                  <button
                    onClick={() => setIsEmailModalOpen(false)}
                    className="mt-4 bg-[#5C2C3E] text-white px-8 py-2 rounded-lg hover:bg-[#4a2332] transition-colors shadow-sm font-medium"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

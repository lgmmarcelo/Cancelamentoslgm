import Papa from 'papaparse';

const csvText = `Carimbo de data/hora,Nome completo (NOME DO TITULAR DO CONTRATO),\nCPF (somente números),\nTelefone / WhatsApp (com DDD),Data da Compra,Qual(is) empreendimento(s) deseja cancelar?,Quantas cotas deseja cancelar?,Qual o PRINCIPAL motivo que levou você a solicitar o cancelamento? (ESCOLHA APENAS UMA OPÇÃO), Além do motivo principal, algum desses fatores também influenciaram na sua decisão de cancelamento? (MARQUE TODAS AS ALTERNATIVAS QUE REFLETEM O MOTIVO DO SEU PEDIDO DE CANCELAMENTO),Como foi a sua experiência com a nossa equipe comercial? (resposta opcional),Qual o seu grau de satisfação geral em todo o processo de atendimento da nossa equipe Comercial (vendas).,Você considera a possibilidade de adquirir uma fração imobiliária no futuro?,Após a apresentação Comercial, foi apresentado para você um Checklist com as principais cláusulas do contrato?,Sugestões de melhorias (resposta opcional),Qual a sala de vendas que você foi atendido?,Nome do vendedor,Nome do negociador/gerente (opcional)
16/03/2026 09:43:20,Adriano Barros Silva ,33364182833,11970359362,15/03/2026,Villagio Resort (Canela),1,Me senti pressionado(a) e não tive tempo de pensar,Me senti pressionado(a) a comprar sem poder tomar uma decisão com calma,,4 - Parcialmente satisfeito,"Talvez, dependendo do preço",Sim. Um profissional leu os itens de um Checklist que resume o contrato,Mais tempo para pensar ,NBA Park,Ludimila,Everton`;

const sanitizeCPF = (rawCpf) => {
  if (rawCpf === undefined || rawCpf === null) return '';
  let cpf = String(rawCpf).replace(/[^\d]/g, '');
  if (cpf.length > 0 && cpf.length < 11) {
    cpf = cpf.padStart(11, '0');
  }
  return cpf;
};

const findKey = (row, keywords) => {
  const keys = Object.keys(row);
  for (const keyword of keywords) {
    const found = keys.find(k => k.toLowerCase().includes(keyword.toLowerCase()));
    if (found) return row[found];
  }
  return '';
};

Papa.parse(csvText, {
  header: true,
  skipEmptyLines: true,
  complete: (results) => {
    const rows = results.data;
    for (const row of rows) {
      const cpfKey = Object.keys(row).find(k => k.toLowerCase().includes('cpf'));
      const rawCpf = cpfKey ? row[cpfKey] : null;
      console.log('rawCpf:', rawCpf);
      
      if (!rawCpf) {
        console.log('Linha sem CPF ignorada');
        continue;
      }

      const cpf = sanitizeCPF(rawCpf);
      console.log('cpf:', cpf, 'length:', cpf.length);
      if (cpf.length !== 11) {
        console.log('CPF inválido ignorado');
        continue;
      }

      const dataSolicitacaoStr = findKey(row, ['carimbo', 'data da solicitação', 'timestamp']);
      const dataCompraStr = findKey(row, ['data da compra', 'data de compra']);
      console.log('dataSolicitacaoStr:', dataSolicitacaoStr);
      console.log('dataCompraStr:', dataCompraStr);
      
      const parseDate = (dateVal) => {
        if (!dateVal) return new Date();
        if (typeof dateVal === 'number') {
          return new Date(Math.round((dateVal - 25569) * 86400 * 1000));
        }
        const dateStr = String(dateVal);
        const parts = dateStr.split(/[\s/:-]/);
        if (parts.length >= 3) {
          if (parts[0].length === 2 && parts[2].length === 4) {
            return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          }
        }
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
      };

      const dataSolicitacao = parseDate(dataSolicitacaoStr);
      const dataCompra = parseDate(dataCompraStr);
      console.log('dataSolicitacao:', dataSolicitacao.toISOString());
      console.log('dataCompra:', dataCompra.toISOString());
      
      const diffTime = Math.abs(dataSolicitacao.getTime() - dataCompra.getTime());
      const diasAteDistrato = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      console.log('diasAteDistrato:', diasAteDistrato);
    }
  }
});

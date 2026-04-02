import * as XLSX from 'xlsx';
import fetch from 'node-fetch';

async function run() {
  const url = 'https://docs.google.com/spreadsheets/d/1RLtBIXLhHzJ5IFJB54LMyaO75btNTghUMFSwjkHOWEI/export?format=xlsx&gid=1627536051';
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  
  const row = jsonData[0];
  const cpfKey = Object.keys(row).find(k => k.toLowerCase().includes('cpf'));
  const rawCpf = row[cpfKey];
  console.log('rawCpf:', rawCpf, 'type:', typeof rawCpf);
  
  const sanitizeCPF = (rawCpf) => {
    if (rawCpf === undefined || rawCpf === null) return '';
    let cpf = String(rawCpf).replace(/[^\d]/g, '');
    if (cpf.length > 0 && cpf.length < 11) {
      cpf = cpf.padStart(11, '0');
    }
    return cpf;
  };
  
  console.log('sanitized:', sanitizeCPF(rawCpf));
}
run();

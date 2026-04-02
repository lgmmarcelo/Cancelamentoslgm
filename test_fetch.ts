import fetch from 'node-fetch';
import Papa from 'papaparse';

async function run() {
  const url = 'https://docs.google.com/spreadsheets/d/1RLtBIXLhHzJ5IFJB54LMyaO75btNTghUMFSwjkHOWEI/export?format=csv&gid=1627536051';
  const res = await fetch(url);
  const text = await res.text();
  
  Papa.parse(text, {
    header: true,
    complete: (results) => {
      const rows = results.data;
      const row = rows[0];
      const cpfKey = Object.keys(row).find(k => k.toLowerCase().includes('cpf'));
      const rawCpf = cpfKey ? row[cpfKey] : null;
      console.log('cpfKey:', cpfKey);
      console.log('rawCpf:', rawCpf);
      console.log('row:', row);
    }
  });
}
run();

import Papa from 'papaparse';
const url = "https://docs.google.com/spreadsheets/d/1RLtBIXLhHzJ5IFJB54LMyaO75btNTghUMFSwjkHOWEI/export?format=csv";
fetch(url)
  .then(res => res.text())
  .then(text => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log("Headers:", results.meta.fields);
        console.log("Total rows:", results.data.length);
      }
    });
  })
  .catch(err => console.error(err));

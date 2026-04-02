import Papa from 'papaparse';
const url = "https://docs.google.com/spreadsheets/d/1RLtBIXLhHzJ5IFJB54LMyaO75btNTghUMFSwjkHOWEI/export?format=csv&gid=1627536051";
fetch(url)
  .then(res => res.text())
  .then(text => {
    Papa.parse(text, {
      header: true,
      complete: (results) => {
        console.log("Headers:", results.meta.fields);
        console.log("First row:", results.data[0]);
      }
    });
  })
  .catch(err => console.error(err));

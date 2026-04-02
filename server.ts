import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Email sending route
  app.post("/api/email/send", async (req, res) => {
    try {
      const { to, subject, html } = req.body;
      
      if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        return res.status(500).json({ error: "SMTP credentials not configured" });
      }

      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      const info = await transporter.sendMail({
        from: `"Laghetto Golden" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      });

      res.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Google Sheet Sync route
  app.get("/api/sync-sheet", async (req, res) => {
    try {
      const clientUrl = req.query.url as string;
      console.log("Recebida requisição para sincronizar planilha:", clientUrl);
      
      let sheetUrl = "https://docs.google.com/spreadsheets/d/1RLtBIXLhHzJ5IFJB54LMyaO75btNTghUMFSwjkHOWEI/export?format=csv&gid=1627536051";
      
      if (clientUrl) {
         // Try to convert a standard view URL to an export URL
         const match = clientUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
         if (match) {
            const spreadsheetId = match[1];
            sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
            
            // Try to extract gid if present
            const gidMatch = clientUrl.match(/gid=([0-9]+)/);
            if (gidMatch) {
                sheetUrl += `&gid=${gidMatch[1]}`;
            }
         } else {
             sheetUrl = clientUrl;
         }
      }
      
      console.log("Tentando buscar dados da URL:", sheetUrl);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout
      
      try {
        const response = await fetch(sheetUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.error(`Erro na resposta do Google Sheets: ${response.status} ${response.statusText}`);
          throw new Error(`Failed to fetch sheet: ${response.status} ${response.statusText}`);
        }
        
        const csvText = await response.text();
        console.log(`Planilha baixada com sucesso. Tamanho: ${csvText.length} bytes`);
        res.send(csvText);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error("A requisição para o Google Sheets expirou (timeout).");
        }
        throw fetchError;
      }
    } catch (error: any) {
      console.error("Error fetching sheet:", error);
      res.status(500).json({ error: "Falha ao buscar planilha", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    
    // Serve static files with caching for assets, but NO caching for index.html
    app.use(express.static(distPath, {
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else {
          // Cache assets for 1 year
          res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
      }
    }));
    
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

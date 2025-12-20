const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Armazena códigos temporariamente (máximo 5 minutos)
const codes = new Map();

app.get('/', (req, res) => {
  res.send('🎵 Callback do Spotify funcionando!');
});

app.get('/callback', (req, res) => {
  const code = req.query.code;
  const state = req.query.state; // Pode usar pra identificar o usuário
  
  if (code) {
    // Salva código temporariamente
    const id = state || Date.now().toString();
    codes.set(id, {
      code: code,
      timestamp: Date.now()
    });
    
    // Remove código após 5 minutos
    setTimeout(() => codes.delete(id), 5 * 60 * 1000);
    
    res.send(`
      <h2>✅ Autenticação concluída!</h2>
      <p>Volte para o WhatsApp e continue.</p>
      <p><small>ID: ${id}</small></p>
    `);
  } else {
    res.send('❌ Erro: código não recebido');
  }
});

// Endpoint para seu bot buscar o código
app.get('/get-code/:id', (req, res) => {
  const id = req.params.id;
  const data = codes.get(id);
  
  if (data) {
    codes.delete(id); // Remove após uso
    res.json({ success: true, code: data.code });
  } else {
    res.json({ success: false, error: 'Código não encontrado ou expirado' });
  }
});

app.listen(port, () => {
  console.log('Servidor rodando na porta ' + port);
});

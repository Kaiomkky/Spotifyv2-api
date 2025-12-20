const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🎵 Callback do Spotify funcionando!');
});

app.get('/callback', (req, res) => {
  const code = req.query.code;
  
  if (code) {
    res.send(`
      <h2>✅ Autenticação concluída!</h2>
      <p>Pode fechar esta aba.</p>
    `);
  } else {
    res.send('❌ Erro: código não recebido');
  }
});

app.listen(port, () => {
  console.log('Servidor rodando na porta ' + port);
});

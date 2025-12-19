const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Spotify OAuth online');
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Code não recebido');
  }

  // aqui você troca o code por token depois
  res.send('Spotify conectado com sucesso, pode fechar');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Servidor OAuth rodando na porta', PORT);
});

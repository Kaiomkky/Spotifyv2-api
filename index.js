const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const app = express();

const clientId = '4315af62f95343a68a4df385b274160d';
const clientSecret = '5b2cb6c4a3654bfbaf0c52656dbddeb2';
const redirectUri = 'https://spotifyv2-api.onrender.com/callback';
const scope = 'user-read-private user-read-email user-read-playback-state user-read-currently-playing';

// Armazenar tokens por sessão (use um DB em produção)
const sessions = new Map();

function gerarRamdomStrint(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function generateCodeChallenge(codeVerifier) {
  const data = Buffer.from(codeVerifier);
  const digest = crypto.createHash('sha256').update(data).digest();
  return digest.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

app.get('/', (req, res) => {
  res.send('Spotify OAuth Server Online ✅');
});

// Gera URL de autorização
app.get('/auth/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId; // ID único do usuário (ex: número WhatsApp)
  const codeVerifier = gerarRamdomStrint(128);
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Salvar o code_verifier para usar depois
  sessions.set(sessionId, { codeVerifier, state: 'pending' });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: redirectUri,
    state: sessionId, // Passar o sessionId como state
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

// Callback do Spotify
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send('Erro: código ou state não recebido');
  }

  const sessionId = state;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(400).send('Sessão não encontrada');
  }

  try {
    // Trocar code por token
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: session.codeVerifier,
    });

    const tokenResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Buscar info do usuário
    const userInfoRes = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const userInfo = userInfoRes.data;

    // Salvar na sessão
    sessions.set(sessionId, {
      accessToken: access_token,
      refreshToken: refresh_token,
      userInfo,
      state: 'connected',
    });

    res.send(`
      <h2>✅ Conectado com sucesso!</h2>
      <p>Olá, <strong>${userInfo.display_name}</strong>!</p>
      <p>Pode fechar esta aba e voltar ao WhatsApp.</p>
    `);
  } catch (error) {
    console.error('Erro ao obter token:', error.response?.data || error.message);
    res.status(500).send('Erro ao conectar com Spotify');
  }
});

// Endpoint para verificar status da sessão (seu bot vai chamar isso)
app.get('/status/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.json({ connected: false });
  }

  res.json({
    connected: session.state === 'connected',
    userInfo: session.userInfo || null,
  });
});

// Endpoint para pegar música atual (seu bot vai chamar isso)
app.get('/current-track/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  const session = sessions.get(sessionId);

  if (!session || !session.accessToken) {
    return res.json({ playing: false, error: 'Not authenticated' });
  }

  try {
    const response = await axios.get(
      'https://api.spotify.com/v1/me/player/currently-playing',
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );

    res.json(response.data || { playing: false });
  } catch (error) {
    // Token expirado? Tentar renovar
    if (error.response?.status === 401 && session.refreshToken) {
      await refreshToken(sessionId);
      return res.json({ playing: false, error: 'Token refreshed, try again' });
    }
    res.json({ playing: false, error: error.message });
  }
});

// Renovar token
async function refreshToken(sessionId) {
  const session = sessions.get(sessionId);
  if (!session || !session.refreshToken) return;

  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    });

    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    session.accessToken = response.data.access_token;
    sessions.set(sessionId, session);
  } catch (error) {
    console.error('Erro ao renovar token:', error.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

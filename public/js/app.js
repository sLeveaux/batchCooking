const statusEl = document.getElementById('status');

async function checkServer() {
  try {
    const res = await fetch('/api/health');
    const health = await res.json();
    if (health.apiKeyConfigured) {
      statusEl.textContent = `Serveur prêt — modèle : ${health.model}`;
      statusEl.className = 'status ok';
    } else {
      statusEl.textContent = 'Serveur prêt, mais aucune clé API : copiez .env.example en .env et renseignez ANTHROPIC_API_KEY.';
      statusEl.className = 'status warn';
    }
  } catch {
    statusEl.textContent = 'Serveur injoignable : lancez « npm start ».';
    statusEl.className = 'status warn';
  }
}

checkServer();

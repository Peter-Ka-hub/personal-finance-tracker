const express = require('express');
const cors = require('cors');

// Inicjalizacja aplikacji Express
const app = express();
// Wybieramy port, na którym będzie działał nasz lokalny serwer
const PORT = 8999; 

// Konfiguracja Middleware (narzędzi pośredniczących)
app.use(cors()); // Zezwala na zapytania z innych adresów (przydatne dla Reacta)
app.use(express.json()); // Pozwala serwerowi odczytywać dane wysyłane w formacie JSON

// Tworzymy nasz pierwszy "Endpoint" (ścieżkę w API)
app.get('/', (req, res) => {
    res.send('Cześć! Mój serwer backendowy działa!');
});

// Uruchomienie serwera
app.listen(PORT, () => {
    console.log(`🚀 Serwer uruchomiony! Nasłuchuję na http://localhost:${PORT}`);
});
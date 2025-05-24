const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { scrapeVilaVixProperty } = require('./scraper');

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Rota de teste
app.get('/', (req, res) => {
    res.json({ 
        message: 'API ImóvelPro funcionando!',
        endpoints: {
            scrape: 'POST /api/scrape',
            health: 'GET /api/health'
        }
    });
});

// Rota de health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

// Rota principal de scraping
app.post('/api/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        
        // Validar URL
        if (!url) {
            return res.status(400).json({ 
                error: 'URL é obrigatória' 
            });
        }
        
        // Verificar se é uma URL válida do Vila Vix
        if (!url.includes('vilaviximoveis.com.br')) {
            return res.status(400).json({ 
                error: 'Por favor, forneça uma URL válida do Vila Vix Imóveis' 
            });
        }
        
        console.log('Recebida solicitação de scraping para:', url);
        
        // Executar scraping
        const propertyData = await scrapeVilaVixProperty(url);
        
        // Retornar dados
        res.json({
            success: true,
            data: propertyData
        });
        
    } catch (error) {
        console.error('Erro no endpoint de scraping:', error);
        res.status(500).json({ 
            error: 'Erro ao processar o imóvel',
            message: error.message 
        });
    }
});

// Rota para buscar taxa SELIC
app.get('/api/selic', async (req, res) => {
    try {
        const axios = require('axios');
        const response = await axios.get(
            'https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados/ultimos/1?formato=json'
        );
        
        if (response.data && response.data.length > 0) {
            res.json({
                success: true,
                rate: parseFloat(response.data[0].valor),
                date: response.data[0].data
            });
        } else {
            throw new Error('Dados SELIC não disponíveis');
        }
    } catch (error) {
        console.error('Erro ao buscar SELIC:', error);
        res.json({
            success: false,
            rate: 11.75, // Taxa padrão de fallback
            message: 'Usando taxa SELIC padrão'
        });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📍 URL local: http://localhost:${PORT}`);
    console.log(`🔑 Google Maps API Key: ${process.env.GOOGLE_MAPS_API_KEY ? 'Configurada' : 'NÃO CONFIGURADA!'}`);
});
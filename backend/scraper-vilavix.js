const puppeteer = require('puppeteer');
const axios = require('axios');

// Função principal de scraping ESPECÍFICA para Vila Vix
async function scrapeVilaVixProperty(url) {
    console.log('🏠 Iniciando scraping Vila Vix de:', url);
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Configurar user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Navegar para a página
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Aguardar conteúdo carregar
        await page.waitForTimeout(3000);
        
        // Extrair dados do imóvel - ESPECÍFICO PARA VILA VIX
        const propertyData = await page.evaluate(() => {
            console.log('Iniciando extração Vila Vix...');
            
            // Função auxiliar para extrair texto
            const getText = (selectors) => {
                if (typeof selectors === 'string') selectors = [selectors];
                for (const selector of selectors) {
                    const el = document.querySelector(selector);
                    if (el) return el.textContent.trim();
                }
                return '';
            };
            
            // Função para extrair número
            const extractNumber = (text) => {
                if (!text) return 0;
                const cleanText = text.replace(/R\$/g, '').replace(/\./g, '').replace(',', '.');
                const match = cleanText.match(/[\d.]+/);
                return match ? parseFloat(match[0]) : 0;
            };
            
            // === EXTRAÇÃO DE CARACTERÍSTICAS ===
            const characteristics = {};
            
            // Vila Vix geralmente mostra características em uma estrutura específica
            // Procurar por padrões de texto específicos
            document.querySelectorAll('div, span, p, li, dt, dd').forEach(el => {
                const text = el.textContent.trim();
                const nextEl = el.nextElementSibling;
                const prevEl = el.previousElementSibling;
                
                // Tipo do Imóvel
                if (text === 'Tipo do Imóvel' && nextEl) {
                    characteristics.type = nextEl.textContent.trim();
                }
                
                // Área Construída
                if (text === 'Área Construída' && nextEl) {
                    characteristics.builtArea = extractNumber(nextEl.textContent);
                }
                
                // Terreno
                if (text === 'Terreno' && nextEl) {
                    characteristics.landArea = extractNumber(nextEl.textContent);
                }
                
                // Área Privativa
                if (text === 'Área Privativa' && nextEl) {
                    characteristics.privateArea = extractNumber(nextEl.textContent);
                }
                
                // Dimensões
                if (text === 'Dimensões' && nextEl) {
                    characteristics.dimensions = nextEl.textContent.trim();
                }
                
                // Dormitórios
                if (text === 'Dormitórios' && nextEl) {
                    const dormText = nextEl.textContent;
                    characteristics.bedrooms = extractNumber(dormText) || 0;
                    characteristics.bedroomsDetail = dormText.trim();
                }
                
                // Banheiros
                if (text === 'Banheiros' && nextEl) {
                    characteristics.bathrooms = extractNumber(nextEl.textContent);
                }
                
                // Vagas
                if (text === 'Vagas' && nextEl) {
                    characteristics.parkingSpaces = extractNumber(nextEl.textContent);
                }
                
                // Também tentar padrões alternativos
                if (text.includes('dormitório') || text.includes('Dormitório')) {
                    const num = extractNumber(text);
                    if (num > 0) characteristics.bedrooms = num;
                }
                
                if (text.includes('banheiro') || text.includes('Banheiro')) {
                    const num = extractNumber(text);
                    if (num > 0) characteristics.bathrooms = num;
                }
                
                if (text.includes('vaga') || text.includes('Vaga')) {
                    const num = extractNumber(text);
                    if (num > 0) characteristics.parkingSpaces = num;
                }
            });
            
            // === EXTRAÇÃO DE DESCRIÇÃO ===
            let description = '';
            
            // Procurar por elementos que contenham "DESCRIÇÃO DO IMÓVEL"
            document.querySelectorAll('*').forEach(el => {
                const text = el.textContent;
                if (text && text.includes('DESCRIÇÃO DO IMÓVEL')) {
                    // Pegar o próximo elemento ou o texto após
                    let descEl = el.nextElementSibling;
                    if (!descEl) {
                        // Tentar pegar o elemento pai
                        descEl = el.parentElement;
                    }
                    
                    if (descEl) {
                        // Pegar todo o texto do container da descrição
                        const fullText = descEl.textContent;
                        // Remover o título "DESCRIÇÃO DO IMÓVEL" se estiver incluído
                        description = fullText.replace('DESCRIÇÃO DO IMÓVEL', '').trim();
                    }
                }
            });
            
            // Se não encontrou, tentar seletores alternativos
            if (!description) {
                description = getText([
                    '.descricao-imovel',
                    '.texto-descricao',
                    '[class*="descricao"]',
                    '.observacoes'
                ]);
            }
            
            // === EXTRAÇÃO DE TÍTULO ===
            const title = getText([
                'h1',
                'h2',
                '.titulo-imovel',
                '.nome-imovel',
                'meta[property="og:title"]'
            ]) || 'Imóvel Vila Vix';
            
            // === EXTRAÇÃO DE PREÇO ===
            let price = 0;
            // Procurar por R$ em todo o documento
            document.querySelectorAll('*').forEach(el => {
                const text = el.textContent;
                if (text && text.includes('R$') && !text.includes('condomínio')) {
                    const num = extractNumber(text);
                    if (num > 10000 && num < 50000000) {
                        price = num;
                    }
                }
            });
            
            // === EXTRAÇÃO DE ENDEREÇO ===
            const address = getText([
                '.endereco-completo',
                '.localizacao-imovel',
                '.endereco',
                '[class*="endereco"]'
            ]) || '';
            
            const neighborhood = getText([
                '.bairro',
                '.nome-bairro',
                '[class*="bairro"]'
            ]) || '';
            
            // === EXTRAÇÃO DE FEATURES ===
            const features = [];
            const featureSelectors = [
                '.caracteristica-item',
                '.item-caracteristica',
                '.lista-caracteristicas li',
                '.caracteristicas-imovel li',
                '.comodidades li'
            ];
            
            featureSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                    const text = el.textContent.trim();
                    if (text && text.length > 2 && !features.includes(text)) {
                        features.push(text);
                    }
                });
            });
            
            // === EXTRAÇÃO DE IMAGENS ===
            const images = [];
            const imageSelectors = [
                '.galeria-fotos img',
                '.carousel img',
                '[class*="galeria"] img',
                '.swiper-slide img',
                'img[src*="imovel"]'
            ];
            
            imageSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(img => {
                    const src = img.src || img.getAttribute('data-src');
                    if (src && src.startsWith('http') && !images.includes(src)) {
                        images.push(src);
                    }
                });
            });
            
            // === MONTAR OBJETO FINAL ===
            return {
                title,
                price: price || 750000,
                address,
                neighborhood,
                // Usar os valores extraídos das características
                bedrooms: characteristics.bedrooms || 3,
                bathrooms: characteristics.bathrooms || 2,
                area: characteristics.builtArea || characteristics.privateArea || 100,
                type: characteristics.type || 'Imóvel',
                description: description || 'Descrição não disponível',
                features,
                images: images.slice(0, 10),
                // Dados adicionais específicos do Vila Vix
                characteristics: {
                    type: characteristics.type,
                    builtArea: characteristics.builtArea,
                    landArea: characteristics.landArea,
                    privateArea: characteristics.privateArea,
                    dimensions: characteristics.dimensions,
                    bedroomsDetail: characteristics.bedroomsDetail,
                    parkingSpaces: characteristics.parkingSpaces
                }
            };
        });
        
        // Log dos dados extraídos
        console.log('📊 Dados extraídos:');
        console.log('- Título:', propertyData.title);
        console.log('- Preço:', propertyData.price);
        console.log('- Tipo:', propertyData.type);
        console.log('- Quartos:', propertyData.bedrooms);
        console.log('- Banheiros:', propertyData.bathrooms);
        console.log('- Área:', propertyData.area, 'm²');
        console.log('- Características:', propertyData.characteristics);
        console.log('- Descrição:', propertyData.description.substring(0, 100) + '...');
        
        // Adicionar ID único
        propertyData.id = 'prop_' + Date.now();
        
        // Geocodificar endereço
        const fullAddress = `${propertyData.address}, ${propertyData.neighborhood}, ES, Brasil`;
        const coordinates = await geocodeAddress(fullAddress);
        propertyData.latitude = coordinates.lat;
        propertyData.longitude = coordinates.lng;
        
        // Buscar amenidades
        propertyData.amenities = await findNearbyAmenities(coordinates.lat, coordinates.lng);
        
        // Calcular distância da praia
        const beachAmenity = propertyData.amenities.find(a => a.type === 'Praia');
        propertyData.beachDistance = beachAmenity ? beachAmenity.distanceMeters : calculateBeachDistance(coordinates.lat, coordinates.lng);
        
        console.log('✅ Scraping concluído com sucesso!');
        return propertyData;
        
    } catch (error) {
        console.error('❌ Erro no scraping:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// === FUNÇÕES AUXILIARES (mantidas do original) ===

async function geocodeAddress(address) {
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        console.log('📍 Geocodificando:', address);
        const encodedAddress = encodeURIComponent(address);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;
        
        const response = await axios.get(url);
        
        if (response.data.results && response.data.results.length > 0) {
            const location = response.data.results[0].geometry.location;
            console.log('✅ Coordenadas:', location);
            return location;
        }
        
        console.log('⚠️ Usando coordenadas padrão de Vila Velha');
        return { lat: -20.3333, lng: -40.2833 };
    } catch (error) {
        console.error('❌ Erro ao geocodificar:', error.message);
        return { lat: -20.3333, lng: -40.2833 };
    }
}

async function findNearbyAmenities(lat, lng) {
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        const amenities = [];
        
        const placeTypes = [
            { type: 'pharmacy', name: 'Farmácia', icon: '💊' },
            { type: 'gym', name: 'Academia', icon: '🏋️‍♀️' },
            { type: 'shopping_mall', name: 'Shopping', icon: '🛍️' },
            { type: 'supermarket', name: 'Supermercado', icon: '🛒' },
            { type: 'restaurant', name: 'Restaurante', icon: '🍽️' },
            { type: 'bank', name: 'Banco', icon: '🏦' },
            { type: 'hospital', name: 'Hospital', icon: '🏥' },
            { type: 'school', name: 'Escola', icon: '🏫' }
        ];
        
        console.log(`🔍 Buscando amenidades próximas...`);
        
        for (const placeType of placeTypes) {
            const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=3000&type=${placeType.type}&key=${apiKey}&language=pt-BR`;
            
            try {
                const response = await axios.get(url);
                
                if (response.data.results && response.data.results.length > 0) {
                    const places = response.data.results.slice(0, 3);
                    
                    for (const place of places) {
                        const distanceKm = calculateDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng);
                        const distanceMeters = Math.round(distanceKm * 1000);
                        
                        amenities.push({
                            id: 'am_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            name: place.name,
                            type: placeType.name,
                            distance: distanceKm,
                            distanceMeters: distanceMeters,
                            address: place.vicinity || 'Endereço não disponível',
                            latitude: place.geometry.location.lat,
                            longitude: place.geometry.location.lng,
                            rating: place.rating || null,
                            icon: placeType.icon
                        });
                    }
                }
            } catch (error) {
                console.error(`⚠️ Erro ao buscar ${placeType.name}:`, error.message);
            }
        }
        
        // Buscar praia
        try {
            const beachUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=praia&location=${lat},${lng}&radius=5000&key=${apiKey}&language=pt-BR`;
            const beachResponse = await axios.get(beachUrl);
            
            if (beachResponse.data.results && beachResponse.data.results.length > 0) {
                const beach = beachResponse.data.results[0];
                const beachDistanceKm = calculateDistance(lat, lng, beach.geometry.location.lat, beach.geometry.location.lng);
                const beachDistanceMeters = Math.round(beachDistanceKm * 1000);
                
                amenities.push({
                    id: 'am_beach_' + Date.now(),
                    name: beach.name,
                    type: 'Praia',
                    distance: beachDistanceKm,
                    distanceMeters: beachDistanceMeters,
                    address: beach.formatted_address || 'Praia',
                    latitude: beach.geometry.location.lat,
                    longitude: beach.geometry.location.lng,
                    rating: beach.rating || null,
                    icon: '🏖️'
                });
            }
        } catch (error) {
            console.error('⚠️ Erro ao buscar praia:', error.message);
        }
        
        amenities.sort((a, b) => a.distance - b.distance);
        console.log(`✅ Encontradas ${amenities.length} amenidades`);
        return amenities;
        
    } catch (error) {
        console.error('❌ Erro ao buscar amenidades:', error);
        return getMockAmenities(lat, lng);
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toRad(deg) {
    return deg * (Math.PI/180);
}

function calculateBeachDistance(lat, lng) {
    const beachLat = -20.3305;
    const beachLng = -40.2855;
    const distance = calculateDistance(lat, lng, beachLat, beachLng);
    return Math.round(distance * 1000);
}

function getMockAmenities(lat, lng) {
    const baseAmenities = [
        { name: 'Farmácia Pacheco', type: 'Farmácia', offset: { lat: 0.002, lng: 0.001 }, icon: '💊' },
        { name: 'Smart Fit', type: 'Academia', offset: { lat: -0.001, lng: 0.002 }, icon: '🏋️‍♀️' },
        { name: 'Shopping Vila Velha', type: 'Shopping', offset: { lat: 0.005, lng: -0.003 }, icon: '🛍️' },
        { name: 'Supermercado Extrabom', type: 'Supermercado', offset: { lat: -0.002, lng: -0.001 }, icon: '🛒' },
        { name: 'Restaurante Sabor da Terra', type: 'Restaurante', offset: { lat: 0.001, lng: -0.002 }, icon: '🍽️' },
        { name: 'Praia da Costa', type: 'Praia', offset: { lat: -0.003, lng: 0.004 }, icon: '🏖️' }
    ];
    
    return baseAmenities.map((amenity, index) => {
        const distance = parseFloat((Math.random() * 1.5 + 0.1).toFixed(1));
        const distanceMeters = Math.round(distance * 1000);
        
        return {
            id: 'am_' + Date.now() + '_' + index,
            name: amenity.name,
            type: amenity.type,
            distance: distance,
            distanceMeters: distanceMeters,
            address: 'Vila Velha, ES',
            latitude: lat + amenity.offset.lat,
            longitude: lng + amenity.offset.lng,
            icon: amenity.icon
        };
    });
}

module.exports = {
    scrapeVilaVixProperty
};
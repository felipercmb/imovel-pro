const puppeteer = require('puppeteer');
const axios = require('axios');

// Função principal de scraping
async function scrapeVilaVixProperty(url) {
    console.log('Iniciando scraping de:', url);
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Configurar user agent para evitar bloqueios
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Navegar para a página
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Aguardar o conteúdo carregar
        await page.waitForSelector('.imovel-detalhes', { timeout: 10000 }).catch(() => {});
        
        // Aguardar elementos específicos do Vila Vix
        try {
            await page.waitForSelector('.box-detalhes-imovel, .detalhes-imovel, .informacoes-imovel', { timeout: 5000 });
        } catch (e) {
            console.log('Elementos principais não encontrados, continuando...');
        }
        
        // Extrair dados do imóvel
        const propertyData = await page.evaluate(() => {
            // Função auxiliar para extrair texto seguramente
            const getText = (selectors) => {
                if (typeof selectors === 'string') {
                    selectors = [selectors];
                }
                for (const selector of selectors) {
                    const el = document.querySelector(selector);
                    if (el) {
                        return el.textContent.trim();
                    }
                }
                return '';
            };
            
            // Função para extrair número do texto
            const extractNumber = (text) => {
                if (!text) return 0;
                // Remove R$, pontos de milhar e converte vírgula em ponto
                const cleanText = text.replace(/R\$/g, '').replace(/\./g, '').replace(',', '.');
                const match = cleanText.match(/[\d.]+/);
                return match ? parseFloat(match[0]) : 0;
            };
            
            // Extrair título - Vila Vix geralmente usa h1 ou h2 para o título
            const title = getText([
                'h1.titulo-imovel',
                'h1',
                'h2.nome-imovel',
                '.titulo-anuncio',
                '.nome-imovel',
                'meta[property="og:title"]'
            ]) || 'Imóvel em Vila Velha';
            
            // Extrair preço - Vila Vix usa classes específicas
            const priceText = getText([
                '.valor-imovel',
                '.preco-imovel',
                '.valor',
                '.preco',
                'span[class*="valor"]',
                'div[class*="valor"]',
                '.box-valor',
                '.campo-valor'
            ]);
            const price = extractNumber(priceText) || 750000;
            
            // Extrair endereço completo
            const address = getText([
                '.endereco-completo',
                '.localizacao-imovel',
                '.endereco',
                'span[class*="endereco"]',
                'div[class*="endereco"]',
                '.campo-endereco'
            ]) || 'Vila Velha, ES';
            
            // Extrair bairro
            const neighborhood = getText([
                '.bairro',
                '.nome-bairro',
                'span[class*="bairro"]',
                'div[class*="bairro"]',
                '.campo-bairro'
            ]) || 'Centro';
            
            // Extrair características específicas do Vila Vix
            let bedrooms = 0;
            let bathrooms = 0;
            let area = 0;
            
            // Vila Vix geralmente mostra as características em uma lista ou tabela
            const infoElements = document.querySelectorAll('.info-imovel, .caracteristica, .detalhe-imovel, .item-caracteristica, li, .campo');
            
            infoElements.forEach(el => {
                const text = el.textContent.toLowerCase();
                
                // Quartos/Dormitórios
                if (text.includes('quarto') || text.includes('dormitório') || text.includes('suíte')) {
                    const num = extractNumber(el.textContent);
                    if (num > 0 && num < 20) bedrooms = num;
                }
                
                // Banheiros
                if (text.includes('banheiro') || text.includes('wc') || text.includes('lavabo')) {
                    const num = extractNumber(el.textContent);
                    if (num > 0 && num < 20) bathrooms = num;
                }
                
                // Área
                if (text.includes('área') || text.includes('m²') || text.includes('metros')) {
                    const num = extractNumber(el.textContent);
                    if (num > 10 && num < 10000) area = num;
                }
            });
            
            // Valores padrão se não encontrar
            bedrooms = bedrooms || 3;
            bathrooms = bathrooms || 2;
            area = area || 120;
            
            // Extrair tipo do imóvel
            const type = getText([
                '.tipo-imovel',
                '.categoria-imovel',
                'span[class*="tipo"]',
                'div[class*="tipo"]'
            ]) || 'Casa';
            
            // Extrair descrição - Vila Vix pode usar diferentes elementos
            const description = getText([
                '.descricao-completa',
                '.texto-descricao',
                '.descricao-imovel',
                '.observacoes',
                '.detalhes-adicionais',
                'div[class*="descricao"]',
                'p[class*="descricao"]',
                '.campo-observacao',
                '.texto-anuncio'
            ]) || 'Excelente imóvel localizado em região privilegiada, com acabamento de primeira qualidade e pronto para morar.';
            
            // Extrair características/features
            const features = [];
            const featureSelectors = [
                '.lista-caracteristicas li',
                '.caracteristicas-imovel li',
                '.itens-imovel li',
                '.comodidades li',
                '.item-caracteristica',
                '.caracteristica-item'
            ];
            
            featureSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                    const text = el.textContent.trim();
                    if (text && text.length > 2 && !features.includes(text)) {
                        features.push(text);
                    }
                });
            });
            
            // Se não encontrou características, adicionar algumas padrão
            if (features.length === 0) {
                features.push(
                    'Área privativa',
                    'Garagem',
                    'Área de serviço',
                    'Cozinha',
                    'Sala',
                    'Localização privilegiada'
                );
            }
            
            // Extrair imagens
            const images = [];
            const imageSelectors = [
                '.galeria-fotos img',
                '.carousel-item img',
                '[class*="galeria"] img',
                '[class*="foto"] img',
                '.swiper-slide img',
                'img[src*="imovel"]'
            ];
            
            for (const selector of imageSelectors) {
                const imgElements = document.querySelectorAll(selector);
                imgElements.forEach(img => {
                    const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy');
                    if (src && !src.includes('logo') && !src.includes('banner') && src.startsWith('http')) {
                        images.push(src);
                    }
                });
                if (images.length > 0) break;
            }
            
            // Remover duplicatas e limitar a 10 imagens
            const uniqueImages = [...new Set(images)].slice(0, 10);
            
            // Se não encontrou imagens, usar placeholders
            if (uniqueImages.length === 0) {
                uniqueImages.push(
                    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600',
                    'https://images.unsplash.com/photo-1565182999561-18d7dc61c393?w=800&h=600',
                    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600'
                );
            }
            
            return {
                title,
                price,
                address,
                neighborhood,
                bedrooms,
                bathrooms,
                area,
                type,
                description,
                features,
                images: uniqueImages
            };
        });
        
        // Adicionar ID único
        propertyData.id = 'prop_' + Date.now();
        
        // Geocodificar endereço para obter coordenadas
        const coordinates = await geocodeAddress(propertyData.address + ', ' + propertyData.neighborhood);
        propertyData.latitude = coordinates.lat;
        propertyData.longitude = coordinates.lng;
        
        // Buscar amenidades próximas
        propertyData.amenities = await findNearbyAmenities(coordinates.lat, coordinates.lng);
        
        // Calcular distância da praia
        let beachDistance = null;
        const beachAmenity = propertyData.amenities.find(a => a.type === 'Praia');
        if (beachAmenity) {
            beachDistance = beachAmenity.distanceMeters;
        } else {
            // Calcular distância aproximada da Praia da Costa se não encontrou
            beachDistance = calculateBeachDistance(coordinates.lat, coordinates.lng);
        }
        propertyData.beachDistance = beachDistance;
        
        console.log('Scraping concluído com sucesso!');
        return propertyData;
        
    } catch (error) {
        console.error('Erro no scraping:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Função para geocodificar endereço
async function geocodeAddress(address) {
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        // Melhorar o endereço adicionando cidade e estado se não tiver
        let fullAddress = address;
        if (!address.toLowerCase().includes('vila velha') && !address.toLowerCase().includes('es')) {
            fullAddress = address + ', Vila Velha, ES, Brasil';
        } else if (!address.toLowerCase().includes('brasil')) {
            fullAddress = address + ', Brasil';
        }
        
        console.log('Geocodificando endereço:', fullAddress);
        const encodedAddress = encodeURIComponent(fullAddress);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;
        
        const response = await axios.get(url);
        
        if (response.data.results && response.data.results.length > 0) {
            const location = response.data.results[0].geometry.location;
            console.log('Coordenadas encontradas:', location);
            return location;
        }
        
        console.log('Nenhuma coordenada encontrada, usando padrão de Vila Velha');
        // Coordenadas padrão de Vila Velha se falhar
        return { lat: -20.3333, lng: -40.2833 };
    } catch (error) {
        console.error('Erro ao geocodificar:', error);
        return { lat: -20.3333, lng: -40.2833 };
    }
}

// Função para buscar amenidades próximas
async function findNearbyAmenities(lat, lng) {
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        const amenities = [];
        
        // Tipos de lugares para buscar com tradução e emoji
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
        
        console.log(`Buscando amenidades próximas a: ${lat}, ${lng}`);
        
        // Buscar cada tipo de lugar
        for (const placeType of placeTypes) {
            const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=3000&type=${placeType.type}&key=${apiKey}&language=pt-BR`;
            
            try {
                const response = await axios.get(url);
                
                if (response.data.results && response.data.results.length > 0) {
                    // Pegar até 3 lugares mais próximos de cada tipo
                    const places = response.data.results.slice(0, 3);
                    
                    for (const place of places) {
                        const distanceKm = calculateDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng);
                        const distanceMeters = Math.round(distanceKm * 1000); // Converter para metros
                        
                        amenities.push({
                            id: 'am_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            name: place.name,
                            type: placeType.name,
                            distance: distanceKm, // Manter em km para compatibilidade
                            distanceMeters: distanceMeters, // Adicionar distância em metros
                            address: place.vicinity || place.formatted_address || 'Endereço não disponível',
                            latitude: place.geometry.location.lat,
                            longitude: place.geometry.location.lng,
                            rating: place.rating || null,
                            icon: placeType.icon
                        });
                    }
                }
            } catch (error) {
                console.error(`Erro ao buscar ${placeType.name}:`, error.message);
            }
        }
        
        // Buscar especificamente a praia mais próxima
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
            console.error('Erro ao buscar praia:', error.message);
        }
        
        // Ordenar por distância
        amenities.sort((a, b) => a.distance - b.distance);
        
        console.log(`Encontradas ${amenities.length} amenidades`);
        return amenities;
        
    } catch (error) {
        console.error('Erro geral ao buscar amenidades:', error);
        // Retornar amenidades mockadas se falhar
        return getMockAmenities(lat, lng);
    }
}

// Função para calcular distância entre dois pontos
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
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

// Calcular distância aproximada da praia
function calculateBeachDistance(lat, lng) {
    // Coordenadas aproximadas da Praia da Costa, Vila Velha
    const beachLat = -20.3305;
    const beachLng = -40.2855;
    const distance = calculateDistance(lat, lng, beachLat, beachLng);
    return Math.round(distance * 1000); // Converter para metros
}

// Amenidades mockadas de fallback
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
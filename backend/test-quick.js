// Script rápido para testar o scraper
require('dotenv').config();
const { scrapeVilaVixProperty } = require('./scraper');

const testUrl = process.argv[2] || 'https://www.vilaviximoveis.com.br/imoveis/venda/ibiracu/pendanga/-/area-de-terra/33/imovel/2516910';

console.log('🚀 Testando scraper com URL:', testUrl);
console.log('⏳ Aguarde, isso pode levar alguns segundos...\n');

scrapeVilaVixProperty(testUrl)
    .then(data => {
        console.log('✅ SUCESSO! Dados extraídos:\n');
        console.log('📋 Informações Básicas:');
        console.log(`   Título: ${data.title}`);
        console.log(`   Preço: R$ ${data.price?.toLocaleString('pt-BR') || 'Não encontrado'}`);
        console.log(`   Endereço: ${data.address}`);
        console.log(`   Bairro: ${data.neighborhood}`);
        console.log(`   Tipo: ${data.type}`);
        
        console.log('\n🏠 Características:');
        console.log(`   Quartos: ${data.bedrooms}`);
        console.log(`   Banheiros: ${data.bathrooms}`);
        console.log(`   Área: ${data.area} m²`);
        
        console.log('\n📝 Descrição:');
        console.log(`   ${data.description?.substring(0, 100)}...`);
        
        console.log('\n📸 Imagens:');
        console.log(`   Total: ${data.images?.length || 0} imagens`);
        if (data.images?.length > 0) {
            console.log(`   Primeira: ${data.images[0]}`);
        }
        
        console.log('\n📍 Localização:');
        console.log(`   Latitude: ${data.latitude}`);
        console.log(`   Longitude: ${data.longitude}`);
        console.log(`   Distância da praia: ${data.beachDistance}m`);
        
        console.log('\n🏪 Pontos de Interesse Próximos:');
        if (data.amenities?.length > 0) {
            data.amenities.slice(0, 5).forEach(amenity => {
                console.log(`   ${amenity.icon} ${amenity.name} (${amenity.type}) - ${amenity.distanceMeters}m`);
            });
        }
        
        // Salvar resultado completo em arquivo
        const fs = require('fs');
        fs.writeFileSync('resultado-scraping.json', JSON.stringify(data, null, 2));
        console.log('\n💾 Resultado completo salvo em: resultado-scraping.json');
    })
    .catch(error => {
        console.error('❌ ERRO:', error.message);
        console.error('\nDica: Verifique se a URL é válida e se o site está acessível.');
    });
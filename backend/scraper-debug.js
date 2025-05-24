const puppeteer = require('puppeteer');
const axios = require('axios');

// Versão de DEBUG do scraper com mais logs
async function scrapeVilaVixPropertyDebug(url) {
    console.log('🔍 DEBUG MODE - Iniciando scraping de:', url);
    
    const browser = await puppeteer.launch({
        headless: false, // Mostrar o navegador para debug
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Configurar user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Navegar para a página
        console.log('📱 Navegando para a página...');
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Esperar um pouco para garantir que tudo carregou
        await page.waitForTimeout(3000);
        
        // Tirar screenshot para debug
        await page.screenshot({ path: 'vila-vix-screenshot.png', fullPage: true });
        console.log('📸 Screenshot salva como vila-vix-screenshot.png');
        
        // Extrair e logar a estrutura HTML
        const htmlStructure = await page.evaluate(() => {
            const selectors = [
                // Preço
                '.valor', '.preco', '.valor-imovel', '.preco-imovel',
                '[class*="valor"]', '[class*="preco"]',
                
                // Características
                '.caracteristica', '.detalhe', '.info-imovel',
                '[class*="quarto"]', '[class*="banheiro"]', '[class*="area"]',
                
                // Descrição
                '.descricao', '.observacao', '.texto',
                '[class*="descricao"]', '[class*="observacao"]',
                
                // Endereço
                '.endereco', '.localizacao', '.bairro',
                '[class*="endereco"]', '[class*="localizacao"]'
            ];
            
            const found = {};
            
            selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    found[selector] = [];
                    elements.forEach(el => {
                        found[selector].push({
                            text: el.textContent.trim().substring(0, 100),
                            classes: el.className,
                            tag: el.tagName
                        });
                    });
                }
            });
            
            // Buscar todas as divs e spans com texto relevante
            const allTexts = [];
            document.querySelectorAll('div, span, p, h1, h2, h3').forEach(el => {
                const text = el.textContent.trim();
                if (text.length > 5 && text.length < 200) {
                    if (text.includes('R$') || text.includes('quarto') || text.includes('banheiro') || 
                        text.includes('m²') || text.includes('área') || text.includes('suíte')) {
                        allTexts.push({
                            text: text,
                            classes: el.className,
                            tag: el.tagName
                        });
                    }
                }
            });
            
            return {
                found: found,
                relevantTexts: allTexts
            };
        });
        
        console.log('\n🔍 ESTRUTURA HTML ENCONTRADA:');
        console.log(JSON.stringify(htmlStructure, null, 2));
        
        // Salvar HTML completo para análise
        const htmlContent = await page.content();
        const fs = require('fs');
        fs.writeFileSync('vila-vix-page.html', htmlContent);
        console.log('\n📄 HTML completo salvo em vila-vix-page.html');
        
        // Extrair dados com mais debug
        const propertyData = await page.evaluate(() => {
            console.log('Iniciando extração de dados...');
            
            // Função para debug
            const debugLog = (label, value) => {
                console.log(`${label}: ${value}`);
                return value;
            };
            
            // Buscar preço de forma mais agressiva
            let price = 0;
            const pricePatterns = /R\$\s*[\d.,]+|[\d.,]+\s*(?:mil|reais)/gi;
            document.querySelectorAll('*').forEach(el => {
                const text = el.textContent;
                if (text && text.match(pricePatterns)) {
                    const matches = text.match(/[\d.,]+/g);
                    if (matches) {
                        matches.forEach(match => {
                            const num = parseFloat(match.replace(/\./g, '').replace(',', '.'));
                            if (num > 10000 && num < 10000000) {
                                price = num;
                                debugLog('Preço encontrado', price);
                            }
                        });
                    }
                }
            });
            
            // Buscar quartos, banheiros e área
            let bedrooms = 0, bathrooms = 0, area = 0;
            
            document.querySelectorAll('*').forEach(el => {
                const text = el.textContent.toLowerCase();
                
                // Quartos
                if ((text.includes('quarto') || text.includes('dormitório') || text.includes('suíte')) && !text.includes('banheiro')) {
                    const match = text.match(/(\d+)\s*(quarto|dormitório|suíte)/i);
                    if (match) {
                        bedrooms = parseInt(match[1]);
                        debugLog('Quartos encontrados', bedrooms);
                    }
                }
                
                // Banheiros
                if (text.includes('banheiro') || text.includes('wc') || text.includes('lavabo')) {
                    const match = text.match(/(\d+)\s*(banheiro|wc|lavabo)/i);
                    if (match) {
                        bathrooms = parseInt(match[1]);
                        debugLog('Banheiros encontrados', bathrooms);
                    }
                }
                
                // Área
                if (text.includes('m²') || text.includes('metros') || text.includes('área')) {
                    const match = text.match(/(\d+)\s*m²|(\d+)\s*metros/i);
                    if (match) {
                        const num = parseInt(match[1] || match[2]);
                        if (num > 20 && num < 5000) {
                            area = num;
                            debugLog('Área encontrada', area);
                        }
                    }
                }
            });
            
            return {
                price: price || 'Não encontrado',
                bedrooms: bedrooms || 'Não encontrado',
                bathrooms: bathrooms || 'Não encontrado',
                area: area || 'Não encontrado',
                debug: true
            };
        });
        
        console.log('\n📊 DADOS EXTRAÍDOS:');
        console.log(propertyData);
        
        // Fechar navegador após 10 segundos para permitir visualização
        console.log('\n⏱️ Fechando navegador em 10 segundos...');
        await page.waitForTimeout(10000);
        
        return propertyData;
        
    } catch (error) {
        console.error('❌ Erro no scraping:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Executar debug se chamado diretamente
if (require.main === module) {
    const url = process.argv[2];
    if (!url) {
        console.log('Uso: node scraper-debug.js <URL>');
        console.log('Exemplo: node scraper-debug.js https://www.vilaviximoveis.com.br/imoveis/venda/...');
        process.exit(1);
    }
    
    scrapeVilaVixPropertyDebug(url).then(() => {
        console.log('\n✅ Debug concluído!');
        process.exit(0);
    }).catch(err => {
        console.error('\n❌ Erro:', err);
        process.exit(1);
    });
}

module.exports = { scrapeVilaVixPropertyDebug };
const puppeteer = require('puppeteer');
const fs = require('fs');

// Script para analisar a estrutura HTML do Vila Vix
async function analyzeVilaVixStructure(url) {
    console.log('🔍 Analisando estrutura do Vila Vix...');
    
    const browser = await puppeteer.launch({
        headless: false, // Mostrar navegador
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForTimeout(3000);
        
        // Analisar estrutura
        const analysis = await page.evaluate(() => {
            const results = {
                characteristics: [],
                description: [],
                price: [],
                possibleSelectors: []
            };
            
            // Buscar elementos que contenham as palavras-chave
            const keywords = [
                'Tipo do Imóvel', 'Área Construída', 'Terreno', 'Área Privativa',
                'Dimensões', 'Dormitórios', 'Banheiros', 'Vagas', 
                'DESCRIÇÃO DO IMÓVEL', 'R$'
            ];
            
            // Analisar todos os elementos
            document.querySelectorAll('*').forEach(el => {
                const text = el.textContent.trim();
                
                // Procurar por características
                keywords.forEach(keyword => {
                    if (text.includes(keyword) && text.length < 500) {
                        const parent = el.parentElement;
                        const next = el.nextElementSibling;
                        
                        results.characteristics.push({
                            keyword: keyword,
                            element: {
                                tag: el.tagName,
                                class: el.className,
                                id: el.id,
                                text: text.substring(0, 100)
                            },
                            parent: parent ? {
                                tag: parent.tagName,
                                class: parent.className
                            } : null,
                            nextSibling: next ? {
                                tag: next.tagName,
                                class: next.className,
                                text: next.textContent.trim().substring(0, 50)
                            } : null
                        });
                    }
                });
                
                // Procurar descrição
                if (text.includes('DESCRIÇÃO DO IMÓVEL')) {
                    let descContainer = el;
                    // Subir na árvore para encontrar o container
                    while (descContainer.parentElement && descContainer.textContent.length < 1000) {
                        descContainer = descContainer.parentElement;
                    }
                    
                    results.description.push({
                        container: {
                            tag: descContainer.tagName,
                            class: descContainer.className,
                            id: descContainer.id
                        },
                        text: descContainer.textContent.substring(0, 300) + '...'
                    });
                }
                
                // Procurar preço
                if (text.includes('R$') && !text.includes('condomínio')) {
                    results.price.push({
                        tag: el.tagName,
                        class: el.className,
                        text: text.substring(0, 50)
                    });
                }
            });
            
            // Encontrar possíveis seletores para características
            const tables = document.querySelectorAll('table');
            const lists = document.querySelectorAll('ul, ol, dl');
            const divs = document.querySelectorAll('div[class*="caracteristica"], div[class*="detalhe"], div[class*="info"]');
            
            results.possibleSelectors.push({
                tables: tables.length,
                lists: lists.length,
                characteristicDivs: divs.length
            });
            
            // Procurar estruturas específicas
            document.querySelectorAll('dt, dd').forEach(el => {
                const text = el.textContent.trim();
                if (text.length > 2 && text.length < 100) {
                    results.possibleSelectors.push({
                        type: 'definition',
                        tag: el.tagName,
                        text: text
                    });
                }
            });
            
            return results;
        });
        
        // Salvar análise
        const report = {
            url: url,
            timestamp: new Date().toISOString(),
            analysis: analysis
        };
        
        fs.writeFileSync('vilavix-analysis.json', JSON.stringify(report, null, 2));
        console.log('📄 Análise salva em vilavix-analysis.json');
        
        // Imprimir resumo
        console.log('\n📊 RESUMO DA ANÁLISE:');
        console.log('Características encontradas:', analysis.characteristics.length);
        console.log('Descrições encontradas:', analysis.description.length);
        console.log('Preços encontrados:', analysis.price.length);
        
        console.log('\n🔍 CARACTERÍSTICAS DETALHADAS:');
        analysis.characteristics.forEach(char => {
            console.log(`\n${char.keyword}:`);
            console.log(`  Elemento: <${char.element.tag} class="${char.element.class}">`);
            if (char.nextSibling) {
                console.log(`  Próximo: <${char.nextSibling.tag}> "${char.nextSibling.text}"`);
            }
        });
        
        // Aguardar antes de fechar
        console.log('\n⏰ Navegador fechará em 15 segundos...');
        await page.waitForTimeout(15000);
        
        return analysis;
        
    } catch (error) {
        console.error('❌ Erro:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const url = process.argv[2];
    if (!url) {
        console.log('Uso: node analyze-vilavix.js <URL>');
        process.exit(1);
    }
    
    analyzeVilaVixStructure(url).then(() => {
        console.log('\n✅ Análise concluída!');
    }).catch(err => {
        console.error('\n❌ Erro:', err);
    });
}

module.exports = { analyzeVilaVixStructure };
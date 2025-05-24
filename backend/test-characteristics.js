// Script específico para testar extração de características
const puppeteer = require('puppeteer');

async function testCharacteristics(url) {
    console.log('🔍 Testando extração de características do Vila Vix...\n');
    
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });
        await page.waitForTimeout(3000);
        
        // Testar diferentes métodos de extração
        const results = await page.evaluate(() => {
            const data = {
                method1_pairs: [],
                method2_tables: [],
                method3_lists: [],
                method4_description: '',
                found_elements: []
            };
            
            // Método 1: Procurar pares label/valor
            const labels = ['Tipo do Imóvel', 'Área Construída', 'Terreno', 'Área Privativa', 
                           'Dimensões', 'Dormitórios', 'Banheiros', 'Vagas'];
            
            document.querySelectorAll('*').forEach(el => {
                const text = el.textContent.trim();
                labels.forEach(label => {
                    if (text === label || text.includes(label)) {
                        let value = '';
                        
                        // Tentar próximo elemento
                        if (el.nextElementSibling) {
                            value = el.nextElementSibling.textContent.trim();
                        }
                        // Tentar próximo nó de texto
                        else if (el.nextSibling && el.nextSibling.nodeType === 3) {
                            value = el.nextSibling.textContent.trim();
                        }
                        // Tentar elemento pai
                        else if (el.parentElement) {
                            const parentText = el.parentElement.textContent;
                            value = parentText.replace(label, '').trim();
                        }
                        
                        if (value) {
                            data.method1_pairs.push({
                                label: label,
                                value: value,
                                element: el.tagName,
                                class: el.className
                            });
                        }
                    }
                });
            });
            
            // Método 2: Procurar em tabelas
            document.querySelectorAll('table').forEach(table => {
                table.querySelectorAll('tr').forEach(row => {
                    const cells = row.querySelectorAll('td, th');
                    if (cells.length >= 2) {
                        data.method2_tables.push({
                            label: cells[0].textContent.trim(),
                            value: cells[1].textContent.trim()
                        });
                    }
                });
            });
            
            // Método 3: Procurar em listas (dl/dt/dd)
            document.querySelectorAll('dl').forEach(dl => {
                const dts = dl.querySelectorAll('dt');
                const dds = dl.querySelectorAll('dd');
                dts.forEach((dt, i) => {
                    if (dds[i]) {
                        data.method3_lists.push({
                            label: dt.textContent.trim(),
                            value: dds[i].textContent.trim()
                        });
                    }
                });
            });
            
            // Método 4: Procurar descrição
            document.querySelectorAll('*').forEach(el => {
                const text = el.textContent;
                if (text && text.includes('DESCRIÇÃO DO IMÓVEL')) {
                    // Pegar o texto completo do container pai
                    let container = el;
                    while (container.parentElement && container.textContent.length < 500) {
                        container = container.parentElement;
                    }
                    data.method4_description = container.textContent
                        .replace('DESCRIÇÃO DO IMÓVEL', '')
                        .trim()
                        .substring(0, 500) + '...';
                }
            });
            
            // Listar elementos encontrados com as palavras-chave
            labels.forEach(label => {
                const elements = document.querySelectorAll(`*:contains("${label}")`);
                const found = Array.from(document.querySelectorAll('*')).filter(el => 
                    el.textContent.includes(label) && el.textContent.length < 200
                );
                
                found.forEach(el => {
                    data.found_elements.push({
                        label: label,
                        tag: el.tagName,
                        class: el.className,
                        parent: el.parentElement?.tagName,
                        text: el.textContent.substring(0, 100)
                    });
                });
            });
            
            return data;
        });
        
        // Mostrar resultados
        console.log('📊 RESULTADOS DA ANÁLISE:\n');
        
        console.log('1️⃣ Método 1 - Pares Label/Valor:');
        if (results.method1_pairs.length > 0) {
            results.method1_pairs.forEach(pair => {
                console.log(`   ${pair.label}: ${pair.value}`);
            });
        } else {
            console.log('   ❌ Nenhum par encontrado');
        }
        
        console.log('\n2️⃣ Método 2 - Tabelas:');
        if (results.method2_tables.length > 0) {
            results.method2_tables.forEach(item => {
                console.log(`   ${item.label}: ${item.value}`);
            });
        } else {
            console.log('   ❌ Nenhuma tabela encontrada');
        }
        
        console.log('\n3️⃣ Método 3 - Listas (DL/DT/DD):');
        if (results.method3_lists.length > 0) {
            results.method3_lists.forEach(item => {
                console.log(`   ${item.label}: ${item.value}`);
            });
        } else {
            console.log('   ❌ Nenhuma lista DL encontrada');
        }
        
        console.log('\n4️⃣ Descrição:');
        if (results.method4_description) {
            console.log(`   ${results.method4_description}`);
        } else {
            console.log('   ❌ Descrição não encontrada');
        }
        
        console.log('\n5️⃣ Elementos encontrados com palavras-chave:');
        const grouped = {};
        results.found_elements.forEach(el => {
            if (!grouped[el.label]) grouped[el.label] = [];
            grouped[el.label].push(el);
        });
        
        Object.keys(grouped).forEach(label => {
            console.log(`\n   ${label}:`);
            grouped[label].forEach(el => {
                console.log(`     - <${el.tag} class="${el.class}">`);
            });
        });
        
        // Salvar resultados
        const fs = require('fs');
        fs.writeFileSync('test-characteristics-result.json', JSON.stringify(results, null, 2));
        console.log('\n💾 Resultados salvos em: test-characteristics-result.json');
        
        console.log('\n⏰ Navegador fechará em 10 segundos...');
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await browser.close();
    }
}

// Executar
if (require.main === module) {
    const url = process.argv[2] || 'https://www.vilaviximoveis.com.br/imoveis/venda/ibiracu/pendanga/-/area-de-terra/33/imovel/2516910';
    testCharacteristics(url);
}

module.exports = { testCharacteristics };
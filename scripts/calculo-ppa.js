/**
 * calculo-ppa.js
 * Contém a lógica de regras e cálculos para a Pré-Pré-Análise (PPA).
 * Refatorado para separar a detecção de falhas, a geração de motivos e o cálculo de sugestões.
 */

// ----------------------------------------------------------------------
// FUNÇÕES AUXILIARES DE CÁLCULO (NÃO ALTERADAS)
// ----------------------------------------------------------------------

/**
 * Calcula o Valor Total do Financiamento (Valor Financiado + Taxas Fixas).
 */
function calcularValorTotal(valorFinanciado) {
    if (valorFinanciado <= 5000) {
        return valorFinanciado + 770;
    } else if (valorFinanciado > 5000 && valorFinanciado <= 7000) {
        return valorFinanciado + 820;
    } else if (valorFinanciado > 7000 && valorFinanciado <= 10000) {
        return valorFinanciado + 870;
    } else {
        return valorFinanciado + 920;
    }
}

/**
 * Calcula o Valor Máximo de Crédito que pode ser financiado com base na Renda.
 */
function calcularValorMaximo(renda) {
    const parcelaMaxima = renda / 3;
    const taxas = [
        { limite: 5000, taxa: 770 },
        { limite: 7000, taxa: 820 },
        { limite: 10000, taxa: 870 },
        { limite: Infinity, taxa: 920 }
    ];
    for (const { limite, taxa } of taxas) {
        const valor = (parcelaMaxima * 36 / 2.44) - taxa;
        if (valor <= limite) {
            return Math.max(valor, 0);
        }
    }
    return 0;
}

// ----------------------------------------------------------------------
// 1. NOVA FUNÇÃO DE PPA (APENAS DETECTA FALHAS)
// ----------------------------------------------------------------------

/**
 * Realiza a PPA e retorna um array com os códigos de todas as regras que falharam.
 * @returns {string[]} Um array de códigos de erro. Retorna um array vazio se for aprovado.
 */
function realizarCalculoPPA(valorMoto, entrada, renda) {
    const falhas = [];
    const valorFinanciado = valorMoto - entrada;
    
    // Teste 1: Entrada mínima de R$ 4.000,00
    if (entrada < 4000) {
        falhas.push('ENTRADA_MIN_4000');
    }
    
    // Teste 2: Entrada mínima de 40% do valor da moto
    if (entrada < valorMoto * 0.40) {
        falhas.push('ENTRADA_MIN_40_PCT');
    }
    
    // Teste 3: Limite de crédito de R$ 12.000,00
    if (valorFinanciado > 12000) {
        falhas.push('CREDITO_MAX_12000');
    }
    
    // Teste 4: Comprometimento de 1/3 da renda
    const valorTotal = calcularValorTotal(valorFinanciado);
    const parcela36 = (valorTotal * 2.44) / 36;
    if (parcela36 > renda / 3) {
        falhas.push('RENDA_INSUFICIENTE');
    }

    return falhas;
}

// ----------------------------------------------------------------------
// 2. FUNÇÃO QUE GERA OS TEXTOS DOS MOTIVOS DE REPROVAÇÃO
// ----------------------------------------------------------------------

/**
 * Recebe os códigos de falha e retorna os textos correspondentes.
 * @param {string[]} codigosDeFalha - Array de códigos de erro da função realizarCalculoPPA.
 * @returns {string[]} Um array com os textos dos motivos.
 */
function obterMotivosDeReprovacao(codigosDeFalha) {
    const mapaDeMotivos = {
        'ENTRADA_MIN_4000': "Entrada mínima de R$ 4.000,00 não atingida.",
        'ENTRADA_MIN_40_PCT': "Entrada menor que 40% do valor da moto.",
        'CREDITO_MAX_12000': "Crédito solicitado acima do limite de R$ 12.000,00.",
        'RENDA_INSUFICIENTE': "A parcela estimada excede 1/3 da sua renda."
    };

    return codigosDeFalha.map(codigo => mapaDeMotivos[codigo]);
}

// ----------------------------------------------------------------------
// 3. FUNÇÃO QUE CALCULA E GERA OS TEXTOS DAS SUGESTÕES
// ----------------------------------------------------------------------

/**
 * Gera sugestões personalizadas com base nas falhas detectadas.
 * @param {string[]} codigosDeFalha - Array de códigos de erro.
 * @param {number} valorMoto - Valor total da moto.
 * @param {number} entrada - Valor da entrada fornecida.
 * @param {number} renda - Renda mensal do cliente.
 * @returns {string[]} Um array com os textos das sugestões.
 */
function calcularSugestoes(codigosDeFalha, valorMoto, entrada, renda) {
    const sugestoes = [];
    const formatBRL = (num) => num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    const falhaDeCreditoOuRenda = codigosDeFalha.includes('RENDA_INSUFICIENTE') || codigosDeFalha.includes('CREDITO_MAX_12000');
    const falhaDeEntrada = codigosDeFalha.includes('ENTRADA_MIN_4000') || codigosDeFalha.includes('ENTRADA_MIN_40_PCT');

    // Cenário 1: Falha por renda ou limite de crédito (estas sugestões têm prioridade)
    if (falhaDeCreditoOuRenda) {
        let valorMaximoFinanciavel = Math.min(calcularValorMaximo(renda), 12000);
        
        // Sugestão de aumentar a entrada
        const novaEntradaSugerida = valorMoto - valorMaximoFinanciavel;
        if (novaEntradaSugerida > entrada) {
            sugestoes.push(`Aumente sua entrada para pelo menos <b>${formatBRL(novaEntradaSugerida)}</b>.`);
        }
        
        // Sugestão de escolher uma moto mais barata
        const novaMotoSugerida = entrada + valorMaximoFinanciavel;
        if (novaMotoSugerida < valorMoto) {
            sugestoes.push(`Escolha uma moto de até <b>${formatBRL(novaMotoSugerida)}</b> (mantendo a entrada atual).`);
        }

    // Cenário 2: Falha APENAS por regras de entrada
    } else if (falhaDeEntrada) {
        const entradaMinimaPercentual = valorMoto * 0.40;
        const entradaMinimaRequerida = Math.max(entradaMinimaPercentual, 4000);
        
        if (entradaMinimaRequerida > entrada) {
            sugestoes.push(`Aumente sua entrada para pelo menos <b>${formatBRL(entradaMinimaRequerida)}</b>.`);
        }
        
        // Esta sugestão só faz sentido se a entrada for menor que 40%
        if (codigosDeFalha.includes('ENTRADA_MIN_40_PCT')) {
             const motoMaximaComEntrada = entrada / 0.40;
             if (motoMaximaComEntrada < valorMoto) {
                sugestoes.push(`Escolha uma moto de até <b>${formatBRL(motoMaximaComEntrada)}</b> (mantendo a entrada atual).`);
             }
        }
    }

    return sugestoes;
}


/**
 * Helper para limpar e converter o valor de um input para número.
 * @param {HTMLElement} inputElement - O elemento de input.
 * @returns {number} O valor numérico.
 */
const cleanAndParse = (inputElement) => {
    if (!inputElement || !inputElement.value) return 0;
    const rawValue = inputElement.value;
    const noThousands = rawValue.replace(/\./g, '');
    const cleanValue = noThousands.replace(',', '.');
    return parseFloat(cleanValue) || 0;
};
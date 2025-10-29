(function () {

    // 1️⃣  Pega o formulário
    const form = document.getElementById('formCadastro');
    if (!form) return;

    // ✅ ID único por envio (usado no back para deduplicar)
    let submissionIdInput = form.querySelector('input[name="submission_id"]');
    if (!submissionIdInput) {
        submissionIdInput = document.createElement('input');
        submissionIdInput.type = 'hidden';
        submissionIdInput.name = 'submission_id';
        form.appendChild(submissionIdInput);
    }
    submissionIdInput.value =
        (crypto?.randomUUID?.() ||
        (Date.now().toString(36) + Math.random().toString(36).slice(2)));

    let isSubmitting = false;

// Cole esta nova versão no lugar da antiga
function setSubmittingState(on, buttonText = null) {
    isSubmitting = on;

    // 1) Desabilita/habilita todos os elementos de navegação
    document.querySelectorAll('.nav-prev, .nav-next, .step-tab').forEach(el => {
        el.disabled = on;
        el.setAttribute('aria-disabled', on ? 'true' : 'false');
        el.style.pointerEvents = on ? 'none' : '';
        el.style.cursor = on ? 'not-allowed' : '';
    });
    
    // 2) Altera o texto do botão principal se um texto for fornecido
    const nextButton = document.querySelector('.nav-next');
    if (nextButton && buttonText !== null) {
        nextButton.textContent = buttonText;
    }
}



  // 2️⃣  Config: coloque aqui sua URL do Apps Script
  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwmo873CoUHZookvIzQTgcLKGRBqaduW2wP4DmCdGsOHT2fcDtc8VsRugbJUwaUIO3U/exec";

  // 3️⃣  Função que monta o JSON com os dados

    function serializeFormToPayload(form) {
        const get = (name) => form.elements[name]?.value?.trim() ?? "";

        return {
            submission_id: get("submission_id"),
            tipo_usuario: get("tipo_usuario"),
            loja: get("loja"),
            nome_vendedor: get("nome_vendedor"),
            email_vendedor: get("email_vendedor"),
            nome_cliente: get("nome_cliente"),
            cpf: get("cpf"),
            cnh: get("cnh"),
            email_cliente: get("email_cliente"),
            telefone: get("telefone"),

            // ✅ manter só estas 3 linhas
            renda_mensal: numFromInput(document.getElementById('renda_mensal')),
            valor_moto:   numFromInput(document.getElementById('valor_moto')),
            valor_entrada:numFromInput(document.getElementById('valor_entrada')),

        };
    }




  // 4️⃣  Função que faz o POST para o Apps Script
    async function postToAppsScript(payload) {
        const body = new URLSearchParams({ data: JSON.stringify(payload) }).toString();
        const res = await fetch(WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body,
        });
        return res.json();
    }


    const steps = Array.from(form.querySelectorAll('.form-step'));
    const tabs = Array.from(document.querySelectorAll('.step-tab'));
    const STEP_TITLES = ['Identificacao','Dados do Vendedor','Dados do Cliente','Dados da Venda'];    
    const stepCurrentLabel = document.querySelector('.step-current-label');
    const btnPrev = form.querySelector('.nav-prev');
    const btnNext = form.querySelector('.nav-next');
    const navButtonGroup = form.querySelector('.nav-button-group');
    const navButtonGroupParent = navButtonGroup ? navButtonGroup.parentElement : null;

    const vendorFieldset = document.getElementById('dados_vendedor');
    const clientFieldset = document.getElementById('dados_cliente');
    const motoFieldset = document.querySelector('#step-4 fieldset');
    const tipoUsuarioRadios = Array.from(form.querySelectorAll('input[name="tipo_usuario"]'));
    const cpfInput = document.getElementById('cpf');
    const emailInputs = Array.from(form.querySelectorAll('input[type="email"]'));
    const telefoneInput = document.getElementById('telefone');
    const valorMotoInput = document.getElementById('valor_moto');
    const valorEntradaInput = document.getElementById('valor_entrada');

    let currentStepIndex = 0;
    let maxStepIndex = 0;
    let currentUserType = null;

    const stepAvailability = steps.map(() => true);

    const storeInitialRequiredState = (container) => {
        if (!container) {
            return;
        }
        const elements = container.querySelectorAll('input, select, textarea');
        elements.forEach((element) => {
            if (element.required) {
                element.dataset.wasRequired = 'true';
            }
        });
    };

    const sanitizeCpf = (value) => value.replace(/[^\d]/g, '');

    const formatCpf = (digits) => {
        const clean = digits.slice(0, 11);
        const parts = [
            clean.slice(0, 3),
            clean.slice(3, 6),
            clean.slice(6, 9),
            clean.slice(9, 11)
        ];

        if (!parts[0]) {
            return '';
        }

        let formatted = parts[0];
        if (parts[1]) {
            formatted += `.${parts[1]}`;
        }
        if (parts[2]) {
            formatted += `.${parts[2]}`;
        }
        if (parts[3]) {
            formatted += `-${parts[3]}`;
        }
        return formatted;
    };

    const isValidCpfDigits = (digits) => {
        const cpf = sanitizeCpf(digits);
        if (cpf.length !== 11) {
            return false;
        }
        if (/^(\d)\1{10}$/.test(cpf)) {
            return false;
        }

        const calcDigit = (sliceLength) => {
            let sum = 0;
            for (let i = 0; i < sliceLength; i += 1) {
                sum += parseInt(cpf[i], 10) * (sliceLength + 1 - i);
            }
            const remainder = sum % 11;
            return remainder < 2 ? 0 : 11 - remainder;
        };

        const digit1 = calcDigit(9);
        if (digit1 !== parseInt(cpf[9], 10)) {
            return false;
        }

        const digit2 = calcDigit(10);
        if (digit2 !== parseInt(cpf[10], 10)) {
            return false;
        }

        return true;
    };

    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

    const sanitizePhoneNumber = (value) => value.replace(/[^\d]/g, '');

    const validBrazilianDDDs = new Set([
        '11','12','13','14','15','16','17','18','19',
        '21','22','24','27','28',
        '31','32','33','34','35','37','38',
        '41','42','43','44','45','46','47','48','49',
        '51','53','54','55',
        '61','62','63','64','65','66','67','68','69',
        '71','73','74','75','77','79',
        '81','82','83','84','85','86','87','88','89',
        '91','92','93','94','95','96','97','98','99'
    ]);

    const validateBrazilianCellphone = (digits) => {
        if (!digits) {
            return { valid: true };
        }
        if (digits.length !== 11) {
            return { valid: false, message: 'Informe um telefone com 11 dígitos (DDD + 9 + número).' };
        }
        const ddd = digits.slice(0, 2);
        if (!validBrazilianDDDs.has(ddd)) {
            return { valid: false, message: 'Informe um DDD brasileiro válido.' };
        }
        if (digits[2] !== '9') {
            return { valid: false, message: 'O número deve iniciar com 9 após o DDD.' };
        }
        return { valid: true };
    };

    const calculateValorEntradaMinimo = () => {
        const vm = numFromInput(valorMotoInput);
        const positive = Number.isFinite(vm) && vm > 0 ? vm : 0;
        const minimo = positive * 0.4;
        return Math.floor(minimo * 100) / 100;
    };



    // Em script.js

    const updateValorEntradaHint = () => {
        if (!valorMotoInput || !valorEntradaInput) return;

        const minimo = calculateValorEntradaMinimo();
        const formatted = minimo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // força repaint do placeholder em todos os navegadores
        valorEntradaInput.removeAttribute('placeholder');
        requestAnimationFrame(() => {
            valorEntradaInput.setAttribute('placeholder', `Min. sugerido: ${formatted}`);
        });
    };





    const updateCpfValidity = (showMessage = false) => {
        if (!cpfInput || cpfInput.disabled) {
            return true;
        }
        const digits = sanitizeCpf(cpfInput.value);
        if (!digits) {
            cpfInput.setCustomValidity('');
            return true;
        }
        const isValid = isValidCpfDigits(digits);
        if (!isValid) {
            if (showMessage) {
                cpfInput.setCustomValidity('Informe um CPF válido.');
            } else {
                cpfInput.setCustomValidity('');
            }
            return false;
        }
        cpfInput.setCustomValidity('');
        return true;
    };

    const updateEmailValidity = (input, showMessage = false) => {
        if (!input || input.disabled) {
            return true;
        }
        const value = (input.value || '').trim();
        if (!value) {
            input.setCustomValidity('');
            return true;
        }
        if (!emailRegex.test(value)) {
            input.setCustomValidity(showMessage ? 'Informe um e-mail válido.' : '');
            return false;
        }
        input.setCustomValidity('');
        return true;
    };

    const updateTelefoneValidity = (showMessage = false) => {
        if (!telefoneInput || telefoneInput.disabled) {
            return true;
        }
        const digits = sanitizePhoneNumber(telefoneInput.value || '');
        if (!digits) {
            telefoneInput.setCustomValidity('');
            return true;
        }
        const result = validateBrazilianCellphone(digits);
        if (!result.valid) {
            telefoneInput.setCustomValidity(showMessage ? result.message : '');
            return false;
        }
        telefoneInput.setCustomValidity('');
        return true;
    };

        // ❌ sem setCustomValidity / reportValidity
    // ✅ escreve a mensagem no #erro_dados_venda, igual à PPA
    const updateValorEntradaValidity = (showMessage = false) => {
        const erroArea = document.getElementById('erro_dados_venda');
        if (!valorEntradaInput || !erroArea) return true;

        // limpa a área antes de validar
        if (showMessage) {
            erroArea.classList.add('hidden');
            erroArea.innerHTML = '';
        }

        const vm = numFromInput(valorMotoInput);
        const minimo = calculateValorEntradaMinimo();
        const ve = numFromInput(valorEntradaInput);

        // vazio / inválido
        if (!valorEntradaInput.value.trim() || !Number.isFinite(ve) || ve <= 0) {
            if (showMessage) {
            erroArea.innerHTML = '❌ Informe um valor de entrada válido.';
            erroArea.classList.remove('hidden');
            }
            return false;
        }

        // maior que moto
        if (Number.isFinite(vm) && ve > vm) {
            if (showMessage) {
            erroArea.innerHTML = '❌ O valor da entrada não pode ser maior que o valor da moto.';
            erroArea.classList.remove('hidden');
            }
            return false;
        }

        // menor que 40%  👉 AQUI ESTÁ A MENSAGEM QUE VOCÊ VAI EDITAR SE QUISER
        /*if (Number.isFinite(vm) && ve + 1e-9 < minimo) {
            if (showMessage) {
            const minimoBRL = minimo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            erroArea.innerHTML = `
            <p>Pedido de Pré Análise recusado.</p>
            <p>A entrada deve ser pelo menos 40% do valor da moto (${minimoBRL}).</p>
            `;
            erroArea.classList.remove('hidden');
            }
            return false;
        }   */

        // válido
        return true;
    };

    

    const isStepEnabled = (index) => Boolean(stepAvailability[index]);

    const setStepEnabled = (index, enabled) => {
        stepAvailability[index] = enabled;
        const step = steps[index];
        if (!step) {
            return;
        }
        step.classList.toggle('is-hidden-step', !enabled);

        const elements = step.querySelectorAll('input, select, textarea');
        elements.forEach((element) => {
            if (enabled) {
                element.disabled = false;
                if (element.dataset.wasRequired === 'true') {
                    element.required = true;
                }
            } else {
                if (element.required) {
                    element.dataset.wasRequired = 'true';
                }
                element.required = false;
                element.disabled = true;
                if (typeof element.setCustomValidity === 'function') {
                    element.setCustomValidity('');
                }
            }
        });
    };

    const findEnabledStep = (startIndex, direction, includeStart = false) => {
        let index = includeStart ? startIndex : startIndex + direction;
        while (index >= 0 && index < steps.length) {
            if (isStepEnabled(index)) {
                return index;
            }
            index += direction;
        }
        return null;
    };

    const getHighestEnabledIndex = () => {
        let highest = 0;
        stepAvailability.forEach((enabled, index) => {
            if (enabled) {
                highest = index;
            }
        });
        return highest;
    };

    const clearFieldset = (fieldset) => {
        if (!fieldset) {
            return;
        }
        const elements = fieldset.querySelectorAll('input, select, textarea');
        elements.forEach((element) => {
            if (element.type === 'radio' || element.type === 'checkbox') {
                element.checked = false;
            } else if (element.tagName === 'SELECT') {
                element.value = '';
            } else {
                element.value = '';
            }
            if (typeof element.setCustomValidity === 'function') {
                element.setCustomValidity('');
            }
            if (emailInputs.includes(element)) {
                updateEmailValidity(element, false);
            }
            if (telefoneInput && element === telefoneInput) {
                updateTelefoneValidity(false);
            }
        });
        if (fieldset.contains(valorMotoInput)) {
            updateValorEntradaHint();
            updateValorEntradaValidity(false);
        }
    };

    const renderTabs = () => {
        tabs.forEach((tab, index) => {
            const enabled = isStepEnabled(index);
            const isActive = index === currentStepIndex;
            tab.classList.toggle('is-active', isActive);
            tab.classList.toggle('is-complete', enabled && index < maxStepIndex);
            tab.classList.toggle('is-disabled', !enabled);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            tab.setAttribute('aria-disabled', (!enabled).toString());
            const shouldDisable = !enabled || (!isActive && index > maxStepIndex);
            tab.disabled = shouldDisable;
            tab.style.cursor = shouldDisable ? 'default' : '';
            tab.style.pointerEvents = shouldDisable ? 'none' : '';
        });

        // Atualiza o rótulo da etapa atual
        atualizarNomeEtapaAtual();
    };


    const atualizarNomeEtapaAtual = () => {
        if (!stepCurrentLabel) return;

        const activeTab = tabs.find((tab) => tab.classList.contains('is-active'));
        if (activeTab) {
            stepCurrentLabel.textContent = activeTab.innerText.trim();
        }
    };


    const renderSteps = () => {
        steps.forEach((step, index) => {
            const enabled = isStepEnabled(index);
            const isActive = index === currentStepIndex;
            step.classList.toggle('is-active', isActive);
            step.classList.toggle('is-hidden-step', !enabled);
            const shouldHide = !enabled || !isActive;
            step.setAttribute('aria-hidden', shouldHide ? 'true' : 'false');
        });
    };

    function showConfirmacao() {
        // liga o estado global
        document.body.classList.add('confirmado');

        // mostra a seção (se ela começa .hidden no HTML)
        const confirma = document.getElementById('tela_confirmacao');
        if (confirma) {
            confirma.classList.remove('hidden');
            confirma.setAttribute('tabindex', '-1');
            confirma.focus({ preventScroll: false });
        }

        // opcional: travar interação do resto
        document.querySelectorAll('input, select, textarea, button').forEach(el => {
            if (!confirma || !confirma.contains(el)) {
            el.disabled = true;
            el.setAttribute('aria-disabled', 'true');
            }
        });
        }





        // Em script.js

   const renderNavigation = () => {
        // Habilita/desabilita o botão Voltar
        btnPrev.disabled = currentStepIndex === 0;

        // Determina se a próxima ação deve ser 'submit' (ou seja, não há próxima etapa habilitada).
        // A função findEnabledStep é usada aqui.
        const shouldSubmit = findEnabledStep(currentStepIndex, 1, false) === null;
        
        // CORREÇÃO: A ação de envio (submit) só é permitida SE shouldSubmit for TRUE 
        // E a etapa atual NÃO for a Etapa 1 (índice 0).
        const isSubmitAction = shouldSubmit && currentStepIndex !== 0;
        
        // Mantém SEMPRE como 'button' para evitar o bug de validação precoce.
        btnNext.type = 'button'; 
        
        btnNext.dataset.action = isSubmitAction ? 'submit' : 'next';
        btnNext.textContent = isSubmitAction ? 'Enviar' : 'Próximo';
        btnNext.setAttribute('aria-label', isSubmitAction ? 'Enviar formulário' : 'Avançar para a próxima etapa');
        
        // Lógica de desabilitar o botão de acordo com a validação (opcional)
        // Você pode ter outras linhas aqui para desabilitar o btnNext que não estão visíveis,
        // mas a lógica principal está acima.
    };

    const showStep = (index) => {
        if (!isStepEnabled(index)) {
            const fallback = findEnabledStep(index, -1, true) ?? findEnabledStep(index, 1, true);
            if (fallback === null) {
                return;
            }
            currentStepIndex = fallback;
        } else {
            currentStepIndex = index;
        }
        renderSteps();
        renderTabs();
        renderNavigation();
        // REMOVIDO: requestAnimationFrame(atualizarNomeEtapaAtual);
        // depois de renderSteps(); renderTabs(); renderNavigation();
        if (currentStepIndex === 3) { // etapa 4 (índice 3)
            updateValorEntradaHint();
        }

    };

    const goToStep = (index) => {
        const normalizedIndex = Math.max(0, Math.min(index, steps.length - 1));
        if (!isStepEnabled(normalizedIndex) || normalizedIndex === currentStepIndex) {
            return;
        }

        if (normalizedIndex > currentStepIndex) {
            if (!validateStep(currentStepIndex)) {
                return;
            }
        }

        if (normalizedIndex > maxStepIndex) {
            maxStepIndex = normalizedIndex;
        }

        showStep(normalizedIndex);
    };

    const handleNext = () => {
        if (!validateStep(currentStepIndex)) {
            return;
        }
            // Ele verifica se estamos saindo da 1ª etapa e se o usuário é comprador
        if (currentStepIndex === 0 && currentUserType === 'comprador') {
            const vendedorTab = tabs[1];
            if (vendedorTab) {
                vendedorTab.classList.add('is-skipped-complete');
            }
        }

        const nextIndex = findEnabledStep(currentStepIndex, 1, false);
        if (nextIndex === null) {
            return;
        }
        maxStepIndex = Math.max(maxStepIndex, nextIndex);
        showStep(nextIndex);
    };

    const handlePrev = () => {
        const previousIndex = findEnabledStep(currentStepIndex, -1, false);
        if (previousIndex === null) {
            return;
        }
        showStep(previousIndex);
    };

    const updateCpfHintValidity = () => {
        updateValorEntradaHint();
        updateValorEntradaValidity(false);
    };

    const refreshContactValidities = () => {
        emailInputs.forEach((input) => updateEmailValidity(input, false));
        updateTelefoneValidity(false);
    };

    const updateStepAvailability = () => {
        const hasUserType = Boolean(currentUserType);
        const isVendor = currentUserType === 'vendedor';

        setStepEnabled(0, true);
        setStepEnabled(1, isVendor);
        setStepEnabled(2, hasUserType);
        setStepEnabled(3, hasUserType);

        const highestEnabled = getHighestEnabledIndex();
        maxStepIndex = Math.min(maxStepIndex, highestEnabled);

        if (!isStepEnabled(currentStepIndex)) {
            const fallback = findEnabledStep(currentStepIndex, -1, true) ?? findEnabledStep(currentStepIndex, 1, true) ?? 0;
            currentStepIndex = fallback;
        }

        renderTabs();
        renderSteps();
        renderNavigation();
        updateCpfHintValidity();
        refreshContactValidities();
    };

    const validateStep = (stepIndex) => {
        if (!isStepEnabled(stepIndex)) {
            return true;
        }
        const step = steps[stepIndex];
        if (!step) {
            return true;
        }
        const fields = Array.from(step.querySelectorAll('input, select, textarea')).filter((field) => !field.disabled);

        for (const field of fields) {
            if (field === cpfInput) {
                updateCpfValidity(true);
            }
            if (emailInputs.includes(field)) {
                updateEmailValidity(field, true);
            }
            if (telefoneInput && field === telefoneInput) {
                updateTelefoneValidity(true);
            }
            if (field === valorEntradaInput) {
                updateValorEntradaValidity(true);
            }

            if (field === valorEntradaInput) {
            if (!updateValorEntradaValidity(true)) return false; // mostra erro “normal”
            continue; // NÃO chama checkValidity/reportValidity para evitar balão
            }

            // Se a validação do campo falhar, reporte o erro e interrompa.
            if (!field.checkValidity()) {
                field.reportValidity();
                return false;
            }
        } 

        return true;
    };

    storeInitialRequiredState(vendorFieldset);
    storeInitialRequiredState(clientFieldset);
    storeInitialRequiredState(motoFieldset);

    setStepEnabled(0, true);
    setStepEnabled(1, false);
    setStepEnabled(2, false);
    setStepEnabled(3, false);

    updateCpfHintValidity();
    refreshContactValidities();

    const preselected = tipoUsuarioRadios.find((radio) => radio.checked);
    if (preselected) {
        currentUserType = preselected.value;
    }

    updateStepAvailability();
    showStep(0);  //DESCOMENTAR ESSA PARTE DPS QUE SAIR DO MODO DEv

    // Em script.js

    // Em script.js

    tipoUsuarioRadios.forEach((radio) => {
        radio.addEventListener('change', (event) => {
            const selectedType = event.target.value;
            const vendedorTab = tabs[1]; // A aba "Dados do Vendedor"

            // Limpa a marcação de "pulado" se o usuário selecionar "Vendedor"
            if (selectedType === 'vendedor') {
                if (vendedorTab) vendedorTab.classList.remove('is-skipped-complete');
            }

            // Lógica existente para limpar os campos e resetar o progresso
            if (currentUserType && currentUserType !== selectedType) {
                if (selectedType === 'comprador') {
                    clearFieldset(vendorFieldset);
                } else {
                    clearFieldset(clientFieldset);
                }
                maxStepIndex = Math.min(maxStepIndex, 0);
            }

            currentUserType = selectedType;
            updateStepAvailability();
        });
    });

    if (btnNext) {
        btnNext.dataset.action = 'next';
        btnNext.addEventListener('click', () => {
            // 🔒 se já estiver enviando, ignora qualquer clique
            if (isSubmitting) return;

            if (btnNext.dataset.action === 'submit') {
            // valida a etapa atual
            if (!validateStep(currentStepIndex)) return;

            // trava tudo imediatamente ao clicar
            setSubmittingState(true);

            // envia o formulário normalmente
            if (typeof form.requestSubmit === 'function') {
                form.requestSubmit();
            } else {
                form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }

            // sai da função (impede outro clique)
            return;
            }

            // caso contrário, apenas avança para próxima etapa
            handleNext();
        });
    }


    if (btnPrev) {
        btnPrev.addEventListener('click', handlePrev);
    }

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
            // 🚫 bloqueia cliques nas etapas durante o envio
            if (isSubmitting) return;
            if (tab.disabled) return;
            goToStep(index);
        });
    });


    if (cpfInput) {
        cpfInput.addEventListener('input', (event) => {
            const digits = sanitizeCpf(event.target.value);
            event.target.value = formatCpf(digits);
            updateCpfValidity(false);
        });
        cpfInput.addEventListener('blur', () => {
            updateCpfValidity(false);
        });
    }

    emailInputs.forEach((input) => {
        input.addEventListener('input', () => {
            updateEmailValidity(input, false);
        });
        input.addEventListener('blur', () => {
            updateEmailValidity(input, false);
        });
    });

    if (telefoneInput) {
        telefoneInput.addEventListener('input', () => {
            updateTelefoneValidity(false);
        });
        telefoneInput.addEventListener('blur', () => {
            updateTelefoneValidity(false);
        });
    }

    if (valorMotoInput) {
        valorMotoInput.addEventListener('input', () => {
            // 1) atualiza o placeholder (dinâmico 40%)
            updateValorEntradaHint();

            // 2) limpa o campo de entrada p/ o placeholder reaparecer
            if (valorEntradaInput && typeof valorEntradaInput.clearMasked === 'function') {
            valorEntradaInput.clearMasked();      // zera estado interno + value
            } else if (valorEntradaInput) {
            valorEntradaInput.value = '';
            // garante que a máscara não restaure nada
            valorEntradaInput._digits = '';
            }

            // 3) revalida sem balão
            updateValorEntradaValidity(false);
        });
    }




    if (valorEntradaInput) {
        valorEntradaInput.addEventListener('input', () => {
            updateValorEntradaValidity(false);
        });
        valorEntradaInput.addEventListener('blur', () => {
            updateValorEntradaValidity(false);
        });
    }

    // === MÁSCARA BRL (2 casas, cresce da direita p/ esquerda) ===
    function formatBRLCentsFromDigits(digits) {
        if (!digits) return '';
        digits = String(digits).replace(/\D/g, '');
        if (digits.length === 1) digits = '0' + digits;
        if (digits.length === 2) digits = '0' + digits;
        const centavos = digits.slice(-2);
        let inteiro = digits.slice(0, -2) || '0';
        inteiro = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${inteiro},${centavos}`;
    }

    function onlyDigitsFromMasked(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function attachBRLMoneyMask(input) {
        if (!input) return;
        let digits = onlyDigitsFromMasked(input.value);

        // mantém vazio no carregamento — permite aparecer placeholder
        input.value = digits ? formatBRLCentsFromDigits(digits) : '';

        // 🔹 função auxiliar pra limpar do lado de fora
        input.clearMasked = () => {
            digits = '';
            input.value = '';
        };

        // === quando o usuário digita ou apaga ===
        input.addEventListener('beforeinput', (e) => {
            const t = e.inputType;

            if (t === 'insertText') {
            if (!/\d/.test(e.data)) { e.preventDefault(); return; }

            digits += e.data;
            input.value = formatBRLCentsFromDigits(digits);

            // 🔸 dispara evento “input” para ativar o listener normal
            input.dispatchEvent(new Event('input', { bubbles: true }));

            e.preventDefault();
            }

            else if (t === 'deleteContentBackward' || t === 'deleteContentForward') {
            digits = digits.slice(0, -1);
            input.value = formatBRLCentsFromDigits(digits);

            // 🔸 dispara evento “input” também ao apagar
            input.dispatchEvent(new Event('input', { bubbles: true }));

            e.preventDefault();
            }

            queueMicrotask(() => input.setSelectionRange(input.value.length, input.value.length));
        });

        // === quando o usuário cola ===
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text') || '';
            const pasted = text.replace(/\D/g, '');
            if (!pasted) return;
            digits += pasted;
            input.value = formatBRLCentsFromDigits(digits);

            // 🔸 dispara evento “input” após colar
            input.dispatchEvent(new Event('input', { bubbles: true }));

            queueMicrotask(() => input.setSelectionRange(input.value.length, input.value.length));
        });

        // === quando foca ===
        input.addEventListener('focus', () => {
            queueMicrotask(() => input.setSelectionRange(input.value.length, input.value.length));
        });

        // retorna número (ex.: "1.234,56" -> 1234.56)
        input.getNumberValue = () => {
            const d = onlyDigitsFromMasked(input.value);
            return d ? Number(d) / 100 : NaN;
        };
    }



    // helper p/ ler número do input (usa a máscara; tem fallback)
    function numFromInput(el) {
        if (!el) return NaN;
        if (typeof el.getNumberValue === 'function') return el.getNumberValue();
        const raw = String(el.value || '').replace(/\./g, '').replace(',', '.');
        const n = Number(raw);
        return Number.isFinite(n) ? n : NaN;
    }

    // aplica a máscara nos três campos
    attachBRLMoneyMask(document.getElementById('valor_moto'));
    attachBRLMoneyMask(document.getElementById('valor_entrada'));
    attachBRLMoneyMask(document.getElementById('renda_mensal'));

// Substitua todo o seu bloco addEventListener por este:
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Inicia o estado de envio: desabilita botões E MUDA O TEXTO
        setSubmittingState(true, 'Enviando...');
        
        const feedbackArea = document.getElementById('erro_dados_venda');
        feedbackArea.classList.add('hidden');
        feedbackArea.innerHTML = '';

        // Coleta os valores numéricos uma única vez no início
        const valorMoto = cleanAndParse(document.getElementById('valor_moto'));
        const entrada = cleanAndParse(document.getElementById('valor_entrada'));
        const renda = cleanAndParse(document.getElementById('renda_mensal'));

        // Pequeno atraso para o usuário perceber a mudança no botão
        await new Promise(resolve => setTimeout(resolve, 300));

        // Executa a PPA com os valores coletados
        const falhas = realizarCalculoPPA(valorMoto, entrada, renda);

        // --- FLUXO DE FALHA DA PPA ---
        if (falhas.length > 0) {
            let mensagemHTML = '<p style="font-weight: bold;">Pré-Análise Não Concedida.</p>';
            const motivos = obterMotivosDeReprovacao(falhas);
            
            // --- CORREÇÃO APLICADA AQUI ---
            // Passa os parâmetros corretos que já coletamos para a função de sugestões
            const sugestoes = calcularSugestoes(falhas, valorMoto, entrada, renda);
            
            const listaMotivos = motivos.map(motivo => `<li>- ${motivo}</li>`).join('');
            mensagemHTML += `<ul class="list-none pl-5">${listaMotivos}<br></ul>`;

            if (sugestoes.length > 0) {
                mensagemHTML += '<p class="mt-3">Para ser aprovado, sugerimos que você:</p>';
                
                if (sugestoes.length == 1){
                    mensagemHTML += `
                    <ul class="list-none pl-5">
                        <li>- ${sugestoes[0]}</li>
                    </ul>
                `;
                }
                else{
                // sempre mostra duas sugestões unidas por "OU"
                mensagemHTML += `
                    <ul class="list-none pl-5">
                        <li>- ${sugestoes[0]} OU</li>
                        <li>- ${sugestoes[1]}</li>
                    </ul>
                `;
                }
            }
            feedbackArea.innerHTML = mensagemHTML;
            feedbackArea.classList.remove('hidden');
            
            // Restaura o estado e o texto original do botão para "Enviar"
            setSubmittingState(false, 'Enviar');

            console.warn('PPA Reprovada! Falhas:', falhas);
            return; // Interrompe a execução aqui
        }
        
        // --- FLUXO DE SUCESSO DA PPA ---
        console.log('PPA Aprovada! Enviando para o Apps Script...');
        const payload = serializeFormToPayload(form);
        
        try {
            const result = await postToAppsScript(payload);

            if (result && result.ok) {
                // Sucesso no envio abre a etapa de sucesso
                showConfirmacao();
    
            } else {
                // Falha no envio (erro retornado pelo servidor)
                alert("Erro ao enviar: " + (result?.error || "desconhecido"));
                setSubmittingState(false, 'Enviar');
            }
        } catch (err) {
            // Falha de comunicação (rede, etc.)
            console.error("Erro na comunicação com Apps Script:", err);
            alert("Ocorreu um erro na comunicação. Tente novamente.");
            setSubmittingState(false, 'Enviar');
        }
    });


})(); // 🛑 FIM DA IIFE GERAL (FINAL DO ARQUIVO)
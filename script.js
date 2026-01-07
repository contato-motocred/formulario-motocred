import { openV2AsPage } from "./ui.js";
import {
  debounce,
  numFromInput,
  serializeFormToPayload,
  serializePayloadFormFinal,
} from "./utils.js";

import {
  preAnalysisRequest,
  calculateLoanRequest,
  createLoanRequest,
  analiseFinal,
} from "./api.js";

import {
  loadInitialFormStorage,
  loadFinalPlaceholderData,
  saveFinalPlaceholderData,
  saveInitialFormFieldValue,
  getFinalPlaceholderValue,
  initialFormData,
  finalPlaceholderData,
  INITIAL_FORM_STORAGE_KEY,
  FINAL_PLACEHOLDER_STORAGE_KEY,
} from "./persistences.js";

import {
  setFlowStage,
  getFlowStage,
  setInitialPPA,
  loadPPA,
  FLOW_STAGES,
  FLOW_STAGE_KEY,
  resetFlowState,
} from "./flowController.js";

let rendaGlobal = 0;
let limit40Global = false;
let lastDownPayment = 0;
let lastCredit = 0;
let nomeClienteFromApi = "";

const FINAL_STEP_IDS = [
  "final_dados_cliente",
  "final_documentacao",
  "final_referencias",
];
const FINAL_FORM_STORAGE_KEY = "formFinalData";
const FINAL_PLACEHOLDER_MAP = [
  { key: "nome", source: "#nome_cliente", target: "#final_nome_cliente" },
  { key: "cpf", source: "#cpf", target: "#final_cpf" },
  { key: "telefone", source: "#telefone", target: "#final_telefone" },
  { key: "email", source: "#email_cliente", target: "#final_email_cliente" },
];

// let finalPlaceholderData = {};
// let initialFormData = {};

loadInitialFormStorage();
loadFinalPlaceholderData();

function updateFinalPlaceholderValue(key, value) {
  if (!key || !value) return;
  const targetConfig = FINAL_PLACEHOLDER_MAP.find((entry) => entry.key === key);
  if (targetConfig) {
    const targetEl = document.querySelector(targetConfig.target);
    if (targetEl) {
      targetEl.placeholder = value;
    }
  }
  if (key === "nome") {
    nomeClienteFromApi = value;
  }
  saveFinalPlaceholderData({ [key]: value });
}

// ENVIO DO FORM FINAL
export async function enviarFinalAnalise(formFinal) {
  const payloadFormFinal = serializePayloadFormFinal(formFinal);
  console.log("[FormFinal] Payload completo:", payloadFormFinal);

  const idFilesList = formFinal.querySelector(
    'input[name="file-doc-id"]'
  )?.files;
  const extratoFilesList = formFinal.querySelector(
    'input[name="file-extrato"]'
  )?.files;
  const residenciaFilesList = formFinal.querySelector(
    'input[name="file-residencia"]'
  )?.files;
  const crlvFile = formFinal.querySelector('input[name="file-crlv"]')?.files[0];

  const formData = new FormData();
  formData.append("payload", JSON.stringify(payloadFormFinal));

  const appendFiles = (fileList, keyName) => {
    // Verifica se a lista existe e tem pelo menos um arquivo
    if (fileList && fileList.length > 0) {
      // Itera sobre todos os arquivos da lista
      for (let i = 0; i < fileList.length; i++) {
        // Anexa o arquivo, usando o mesmo nome (keyName).
        // O FormData lidará com múltiplos valores para a mesma chave.
        formData.append(keyName, fileList[i]);
      }
    }
  };
  appendFiles(idFilesList, "identity");
  appendFiles(extratoFilesList, "extract");
  appendFiles(residenciaFilesList, "residence");
  if (crlvFile) formData.append("crlv", crlvFile);

  console.log("[formdata tem os pdfs] FormData enviado:", formData);
  // Verifique o conteúdo do FormData (apenas para debug)
  for (var pair of formData.entries()) {
    console.log(pair[0] + ": " + pair[1]);
  }

  const url =
    "https://script.google.com/macros/s/AKfycbxqxRTACwCSMkYTRFSOKEEES5GlZSEGsnirVc7o_vLmvzKRyAAHt5zuta1r3In_mH3HIw/exec";

  try {
    console.log("[FormFinal] Payload completo:", formData);
    const response = await analiseFinal(formData);

    const result = await response.json();

    return result;
  } catch (erro) {
    console.error("Erro ao enviar:", erro);
    return { ok: false, erro };
  }
}

(function () {
  console.log("[PPA] Script carregado. Versão:", new Date().toISOString());

  if (!localStorage.getItem(FLOW_STAGE_KEY)) {
    setFlowStage(FLOW_STAGES.FORMULARIO_INICIAL);
  }

  // 1??  Pega o formulário
  const form = document.getElementById("formCadastro");
  if (!form) return;

  // ? ID único por envio (usado no back para deduplicar)
  let submissionIdInput = form.querySelector('input[name="submission_id"]');
  if (!submissionIdInput) {
    submissionIdInput = document.createElement("input");
    submissionIdInput.type = "hidden";
    submissionIdInput.name = "submission_id";
    form.appendChild(submissionIdInput);
  }
  submissionIdInput.value =
    crypto?.randomUUID?.() ||
    Date.now().toString(36) + Math.random().toString(36).slice(2);

  let isSubmitting = false;

  // Cole esta nova versão no lugar da antiga
  function setSubmittingState(on, buttonText = null) {
    isSubmitting = on;

    // 1) Desabilita/habilita todos os elementos de navegação
    document
      .querySelectorAll(".nav-prev, .nav-next, .step-tab")
      .forEach((el) => {
        el.disabled = on;
        el.setAttribute("aria-disabled", on ? "true" : "false");
        el.style.pointerEvents = on ? "none" : "";
        el.style.cursor = on ? "not-allowed" : "";
      });

    // 2) Altera o texto do botão principal se um texto for fornecido
    const nextButton = document.querySelector(".nav-next");
    if (nextButton && buttonText !== null) {
      nextButton.textContent = buttonText;
    }
  }

  const steps = Array.from(form.querySelectorAll(".form-step"));
  const tabs = Array.from(document.querySelectorAll(".step-tab"));
  const STEP_TITLES = [
    "Identificacao",
    "Dados do Vendedor",
    "Dados do Cliente",
    "Dados da Venda",
  ];
  const stepCurrentLabel = document.querySelector(".step-current-label");
  const btnPrev = form.querySelector(".nav-prev");
  const btnNext = form.querySelector(".nav-next");
  const navButtonGroup = form.querySelector(".nav-button-group");
  const navButtonGroupParent = navButtonGroup
    ? navButtonGroup.parentElement
    : null;

  const vendorFieldset = document.getElementById("dados_vendedor");
  const clientFieldset = document.getElementById("dados_cliente");
  const motoFieldset = document.querySelector("#step-4 fieldset");
  const tipoUsuarioRadios = Array.from(
    form.querySelectorAll('input[name="tipo_usuario"]')
  );
  const cpfInput = document.getElementById("cpf");
  const emailInputs = Array.from(form.querySelectorAll('input[type="email"]'));
  const telefoneInput = document.getElementById("telefone");
  const nomeClienteInput = document.getElementById("nome_cliente");
  const emailClienteInput = document.getElementById("email_cliente");
  const valorMotoInput = document.getElementById("valor_moto");
  const valorEntradaInput = document.getElementById("valor_entrada");

  let currentStepIndex = 0;
  let maxStepIndex = 0;
  let currentUserType = null;

  const stepAvailability = steps.map(() => true);

  const shouldPersistInitialField = (field) => {
    if (!field || !field.name) return false;
    const type = (field.type || "").toLowerCase();
    if (type === "password" || type === "file" || type === "hidden")
      return false;
    if (field.dataset.persist === "false") return false;
    return true;
  };

  const initialPersistableFields = Array.from(
    form.querySelectorAll("input, select, textarea")
  ).filter(shouldPersistInitialField);

  const saveInitialFieldValue = (field) => {
    if (!field || !field.name) return;
    if (field.type === "checkbox") {
      saveInitialFormFieldValue(field.name, field.checked);
    } else if (field.type === "radio") {
      if (field.checked) {
        saveInitialFormFieldValue(field.name, field.value);
      }
    } else {
      saveInitialFormFieldValue(field.name, field.value);
    }
  };

  const restoreInitialFormFields = () => {
    if (!initialFormData || typeof initialFormData !== "object") return;
    initialPersistableFields.forEach((field) => {
      const storedValue = initialFormData[field.name];
      if (storedValue === undefined) return;
      if (field.type === "checkbox") {
        field.checked = Boolean(storedValue);
      } else if (field.type === "radio") {
        field.checked = field.value === storedValue;
      } else {
        field.value = storedValue;
      }
    });
  };

  restoreInitialFormFields();

  initialPersistableFields.forEach((field) => {
    const eventName =
      field.type === "checkbox" ||
      field.type === "radio" ||
      field.tagName === "SELECT"
        ? "change"
        : "input";

    const handler = () => {
      if (field.type === "radio" && !field.checked) return;
      saveInitialFieldValue(field);
    };

    field.addEventListener(eventName, handler);

    if (field.type === "radio") {
      if (field.checked) {
        saveInitialFieldValue(field);
      }
    } else {
      saveInitialFieldValue(field);
    }
  });

  FINAL_PLACEHOLDER_MAP.forEach(({ key, source }) => {
    const el =
      source === "#cpf"
        ? cpfInput
        : source === "#telefone"
        ? telefoneInput
        : source === "#nome_cliente"
        ? nomeClienteInput
        : source === "#email_cliente"
        ? emailClienteInput
        : document.querySelector(source);

    if (!el) return;
    const persistValue = () => {
      const value = el.value?.trim() ?? "";
      if (!value) return;
      saveFinalPlaceholderData({ [key]: value });
    };
    el.addEventListener("input", persistValue);
    el.addEventListener("blur", persistValue);
    persistValue();
  });

  const storeInitialRequiredState = (container) => {
    if (!container) {
      return;
    }
    const elements = container.querySelectorAll("input, select, textarea");
    elements.forEach((element) => {
      if (element.required) {
        element.dataset.wasRequired = "true";
      }
    });
  };

  const sanitizeCpf = (value) => value.replace(/[^\d]/g, "");

  const formatCpf = (digits) => {
    const clean = digits.slice(0, 11);
    const parts = [
      clean.slice(0, 3),
      clean.slice(3, 6),
      clean.slice(6, 9),
      clean.slice(9, 11),
    ];

    if (!parts[0]) {
      return "";
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

  const sanitizePhoneNumber = (value) => value.replace(/[^\d]/g, "");

  const validBrazilianDDDs = new Set([
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "21",
    "22",
    "24",
    "27",
    "28",
    "31",
    "32",
    "33",
    "34",
    "35",
    "37",
    "38",
    "41",
    "42",
    "43",
    "44",
    "45",
    "46",
    "47",
    "48",
    "49",
    "51",
    "53",
    "54",
    "55",
    "61",
    "62",
    "63",
    "64",
    "65",
    "66",
    "67",
    "68",
    "69",
    "71",
    "73",
    "74",
    "75",
    "77",
    "79",
    "81",
    "82",
    "83",
    "84",
    "85",
    "86",
    "87",
    "88",
    "89",
    "91",
    "92",
    "93",
    "94",
    "95",
    "96",
    "97",
    "98",
    "99",
  ]);

  const validateBrazilianCellphone = (digits) => {
    if (!digits) {
      return { valid: true };
    }
    if (digits.length !== 11) {
      return {
        valid: false,
        message: "Informe um telefone com 11 dígitos (DDD + 9 + número).",
      };
    }
    const ddd = digits.slice(0, 2);
    if (!validBrazilianDDDs.has(ddd)) {
      return { valid: false, message: "Informe um DDD brasileiro válido." };
    }
    if (digits[2] !== "9") {
      return {
        valid: false,
        message: "O número deve iniciar com 9 após o DDD.",
      };
    }
    return { valid: true };
  };

  const calculateValorEntradaMinimo = () => {
    const vm = numFromInput(valorMotoInput);
    const positive = Number.isFinite(vm) && vm > 0 ? vm : 0;
    const minimo = positive * 0.4;
    return Math.floor(minimo * 100) / 100;
  };

  const updateValorEntradaHint = () => {
    if (!valorMotoInput || !valorEntradaInput) return;

    let minimo = calculateValorEntradaMinimo();
    if (minimo < 4000) {
      minimo = 4000;
    }
    const formatted = minimo.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    // força repaint do placeholder em todos os navegadores
    valorEntradaInput.removeAttribute("placeholder");
    requestAnimationFrame(() => {
      valorEntradaInput.setAttribute(
        "placeholder",
        `Min. sugerido: ${formatted}`
      );
    });
  };

  const updateCpfValidity = (showMessage = false) => {
    if (!cpfInput || cpfInput.disabled) {
      return true;
    }
    const digits = sanitizeCpf(cpfInput.value);
    if (!digits) {
      cpfInput.setCustomValidity("");
      return true;
    }
    const isValid = isValidCpfDigits(digits);
    if (!isValid) {
      if (showMessage) {
        cpfInput.setCustomValidity("Informe um CPF válido.");
      } else {
        cpfInput.setCustomValidity("");
      }
      return false;
    }
    cpfInput.setCustomValidity("");
    return true;
  };

  const updateEmailValidity = (input, showMessage = false) => {
    if (!input || input.disabled) {
      return true;
    }
    const value = (input.value || "").trim();
    if (!value) {
      input.setCustomValidity("");
      return true;
    }
    if (!emailRegex.test(value)) {
      input.setCustomValidity(showMessage ? "Informe um e-mail válido." : "");
      return false;
    }
    input.setCustomValidity("");
    return true;
  };

  const updateTelefoneValidity = (showMessage = false) => {
    if (!telefoneInput || telefoneInput.disabled) {
      return true;
    }
    const digits = sanitizePhoneNumber(telefoneInput.value || "");
    if (!digits) {
      telefoneInput.setCustomValidity("");
      return true;
    }
    const result = validateBrazilianCellphone(digits);
    if (!result.valid) {
      telefoneInput.setCustomValidity(showMessage ? result.message : "");
      return false;
    }
    telefoneInput.setCustomValidity("");
    return true;
  };

  // ? sem setCustomValidity / reportValidity
  // ? escreve a mensagem no #erro_dados_venda, igual à PPA
  const updateValorEntradaValidity = (showMessage = false) => {
    const erroArea = document.getElementById("erro_dados_venda");
    if (!valorEntradaInput || !erroArea) return true;

    // limpa a área antes de validar
    if (showMessage) {
      erroArea.classList.add("hidden");
      erroArea.innerHTML = "";
    }

    const vm = numFromInput(valorMotoInput);
    const minimo = calculateValorEntradaMinimo();
    const ve = numFromInput(valorEntradaInput);

    // vazio / inválido
    if (!valorEntradaInput.value.trim() || !Number.isFinite(ve) || ve <= 0) {
      if (showMessage) {
        erroArea.innerHTML = "Informe um valor de entrada válido.";
        erroArea.classList.remove("hidden");
      }
      return false;
    }

    // maior que moto
    if (Number.isFinite(vm) && ve > vm) {
      if (showMessage) {
        erroArea.innerHTML =
          "O valor da entrada não pode ser maior que o valor da moto.";
        erroArea.classList.remove("hidden");
      }
      return false;
    }

    // maior que moto
    if (Number.isFinite(vm) && ve == vm) {
      if (showMessage) {
        erroArea.innerHTML =
          "O valor da entrada não pode ser igual ao valor da moto.";
        erroArea.classList.remove("hidden");
      }
      return false;
    }

    // menor que 40%  ?? AQUI ESTÁ A MENSAGEM QUE VOCÊ VAI EDITAR SE QUISER
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
    step.classList.toggle("is-hidden-step", !enabled);

    const elements = step.querySelectorAll("input, select, textarea");
    elements.forEach((element) => {
      if (enabled) {
        element.disabled = false;
        if (element.dataset.wasRequired === "true") {
          element.required = true;
        }
      } else {
        if (element.required) {
          element.dataset.wasRequired = "true";
        }
        element.required = false;
        element.disabled = true;
        if (typeof element.setCustomValidity === "function") {
          element.setCustomValidity("");
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
    const elements = fieldset.querySelectorAll("input, select, textarea");
    elements.forEach((element) => {
      if (element.type === "radio" || element.type === "checkbox") {
        element.checked = false;
      } else if (element.tagName === "SELECT") {
        element.value = "";
      } else {
        element.value = "";
      }
      if (typeof element.setCustomValidity === "function") {
        element.setCustomValidity("");
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
      tab.classList.toggle("is-active", isActive);
      tab.classList.toggle("is-complete", enabled && index < maxStepIndex);
      tab.classList.toggle("is-disabled", !enabled);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
      tab.setAttribute("aria-disabled", (!enabled).toString());
      const shouldDisable = !enabled || (!isActive && index > maxStepIndex);
      tab.disabled = shouldDisable;
      tab.style.cursor = shouldDisable ? "default" : "";
      tab.style.pointerEvents = shouldDisable ? "none" : "";
    });

    // Atualiza o rótulo da etapa atual
    atualizarNomeEtapaAtual();
  };

  const atualizarNomeEtapaAtual = () => {
    if (!stepCurrentLabel) return;

    const activeTab = tabs.find((tab) => tab.classList.contains("is-active"));
    if (activeTab) {
      stepCurrentLabel.textContent = activeTab.innerText.trim();
    }
  };

  const renderSteps = () => {
    steps.forEach((step, index) => {
      const enabled = isStepEnabled(index);
      const isActive = index === currentStepIndex;
      step.classList.toggle("is-active", isActive);
      step.classList.toggle("is-hidden-step", !enabled);
      const shouldHide = !enabled || !isActive;
      step.setAttribute("aria-hidden", shouldHide ? "true" : "false");
    });
  };

  function showConfirmacao() {
    // liga o estado global
    document.body.classList.add("confirmado");

    // mostra a seção (se ela começa .hidden no HTML)
    const confirma = document.getElementById("tela_confirmacao");
    if (confirma) {
      confirma.classList.remove("hidden");
      confirma.setAttribute("tabindex", "-1");
      confirma.focus({ preventScroll: false });
    }

    // opcional: travar interação do resto
    document
      .querySelectorAll("input, select, textarea, button")
      .forEach((el) => {
        if (!confirma || !confirma.contains(el)) {
          el.disabled = true;
          el.setAttribute("aria-disabled", "true");
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
    btnNext.type = "button";

    btnNext.dataset.action = isSubmitAction ? "submit" : "next";
    btnNext.textContent = isSubmitAction ? "Enviar" : "Próximo";
    btnNext.setAttribute(
      "aria-label",
      isSubmitAction ? "Enviar formulário" : "Avançar para a próxima etapa"
    );

    // Lógica de desabilitar o botão de acordo com a validação (opcional)
    // Você pode ter outras linhas aqui para desabilitar o btnNext que não estão visíveis,
    // mas a lógica principal está acima.
  };

  const showStep = (index) => {
    if (!isStepEnabled(index)) {
      const fallback =
        findEnabledStep(index, -1, true) ?? findEnabledStep(index, 1, true);
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
    if (currentStepIndex === 3) {
      // etapa 4 (índice 3)
      updateValorEntradaHint();
    }
  };

  const goToStep = (index) => {
    const normalizedIndex = Math.max(0, Math.min(index, steps.length - 1));
    if (
      !isStepEnabled(normalizedIndex) ||
      normalizedIndex === currentStepIndex
    ) {
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
    if (currentStepIndex === 0 && currentUserType === "comprador") {
      const vendedorTab = tabs[1];
      if (vendedorTab) {
        vendedorTab.classList.add("is-skipped-complete");
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
    const isVendor = currentUserType === "vendedor";

    setStepEnabled(0, true);
    setStepEnabled(1, isVendor);
    setStepEnabled(2, hasUserType);
    setStepEnabled(3, hasUserType);

    const highestEnabled = getHighestEnabledIndex();
    maxStepIndex = Math.min(maxStepIndex, highestEnabled);

    if (!isStepEnabled(currentStepIndex)) {
      const fallback =
        findEnabledStep(currentStepIndex, -1, true) ??
        findEnabledStep(currentStepIndex, 1, true) ??
        0;
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
    const fields = Array.from(
      step.querySelectorAll("input, select, textarea")
    ).filter((field) => !field.disabled);

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
  showStep(0); //DESCOMENTAR ESSA PARTE DPS QUE SAIR DO MODO DEv

  // Em script.js

  // Em script.js

  tipoUsuarioRadios.forEach((radio) => {
    radio.addEventListener("change", (event) => {
      const selectedType = event.target.value;
      const vendedorTab = tabs[1]; // A aba "Dados do Vendedor"

      // Limpa a marcação de "pulado" se o usuário selecionar "Vendedor"
      if (selectedType === "vendedor") {
        if (vendedorTab) vendedorTab.classList.remove("is-skipped-complete");
      }

      // Lógica existente para limpar os campos e resetar o progresso
      if (currentUserType && currentUserType !== selectedType) {
        if (selectedType === "comprador") {
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
    btnNext.dataset.action = "next";
    btnNext.addEventListener("click", () => {
      // ?? se já estiver enviando, ignora qualquer clique
      if (isSubmitting) return;

      if (btnNext.dataset.action === "submit") {
        // valida a etapa atual
        if (!validateStep(currentStepIndex)) return;

        // trava tudo imediatamente ao clicar
        setSubmittingState(true);

        // envia o formulário normalmente
        if (typeof form.requestSubmit === "function") {
          form.requestSubmit();
        } else {
          form.dispatchEvent(
            new Event("submit", { cancelable: true, bubbles: true })
          );
        }

        // sai da função (impede outro clique)
        return;
      }

      // caso contrário, apenas avança para próxima etapa
      handleNext();
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener("click", handlePrev);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      // ?? bloqueia cliques nas etapas durante o envio
      if (isSubmitting) return;
      if (tab.disabled) return;
      goToStep(index);
    });
  });

  if (cpfInput) {
    cpfInput.addEventListener("input", (event) => {
      const digits = sanitizeCpf(event.target.value);
      event.target.value = formatCpf(digits);
      updateCpfValidity(false);
    });
    cpfInput.addEventListener("blur", () => {
      updateCpfValidity(false);
    });
  }

  emailInputs.forEach((input) => {
    input.addEventListener("input", () => {
      updateEmailValidity(input, false);
    });
    input.addEventListener("blur", () => {
      updateEmailValidity(input, false);
    });
  });

  if (telefoneInput) {
    telefoneInput.addEventListener("input", () => {
      updateTelefoneValidity(false);
    });
    telefoneInput.addEventListener("blur", () => {
      updateTelefoneValidity(false);
    });
  }

  if (valorMotoInput) {
    valorMotoInput.addEventListener("input", () => {
      // 1) atualiza o placeholder (dinâmico 40%)
      updateValorEntradaHint();

      // 2) limpa o campo de entrada p/ o placeholder reaparecer
      if (
        valorEntradaInput &&
        typeof valorEntradaInput.clearMasked === "function"
      ) {
        valorEntradaInput.clearMasked(); // zera estado interno + value
      } else if (valorEntradaInput) {
        valorEntradaInput.value = "";
        // garante que a máscara não restaure nada
        valorEntradaInput._digits = "";
      }

      // 3) revalida sem balão
      updateValorEntradaValidity(false);
    });
  }

  if (valorEntradaInput) {
    valorEntradaInput.addEventListener("input", () => {
      updateValorEntradaValidity(false);
    });
    valorEntradaInput.addEventListener("blur", () => {
      updateValorEntradaValidity(false);
    });
  }

  // === MÁSCARA BRL (2 casas, cresce da direita p/ esquerda) ===
  function formatBRLCentsFromDigits(digits) {
    if (!digits) return "";
    digits = String(digits).replace(/\D/g, "");
    if (digits.length === 1) digits = "0" + digits;
    if (digits.length === 2) digits = "0" + digits;
    const centavos = digits.slice(-2);
    let inteiro = digits.slice(0, -2) || "0";
    inteiro = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${inteiro},${centavos}`;
  }

  function onlyDigitsFromMasked(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function attachBRLMoneyMask(input) {
    if (!input) return;
    let digits = onlyDigitsFromMasked(input.value);

    // mantém vazio no carregamento — permite aparecer placeholder
    input.value = digits ? formatBRLCentsFromDigits(digits) : "";

    // ?? função auxiliar pra limpar do lado de fora
    input.clearMasked = () => {
      digits = "";
      input.value = "";
    };

    // === quando o usuário digita ou apaga ===
    input.addEventListener("beforeinput", (e) => {
      const t = e.inputType;

      if (t === "insertText") {
        if (!/\d/.test(e.data)) {
          e.preventDefault();
          return;
        }

        digits += e.data;
        input.value = formatBRLCentsFromDigits(digits);

        // ?? dispara evento “input” para ativar o listener normal
        input.dispatchEvent(new Event("input", { bubbles: true }));

        e.preventDefault();
      } else if (
        t === "deleteContentBackward" ||
        t === "deleteContentForward"
      ) {
        digits = digits.slice(0, -1);
        input.value = formatBRLCentsFromDigits(digits);

        // ?? dispara evento “input” também ao apagar
        input.dispatchEvent(new Event("input", { bubbles: true }));

        e.preventDefault();
      }

      queueMicrotask(() =>
        input.setSelectionRange(input.value.length, input.value.length)
      );
    });

    // === quando o usuário cola ===
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const text =
        (e.clipboardData || window.clipboardData).getData("text") || "";
      const pasted = text.replace(/\D/g, "");
      if (!pasted) return;
      digits += pasted;
      input.value = formatBRLCentsFromDigits(digits);

      // ?? dispara evento “input” após colar
      input.dispatchEvent(new Event("input", { bubbles: true }));

      queueMicrotask(() =>
        input.setSelectionRange(input.value.length, input.value.length)
      );
    });

    // === quando foca ===
    input.addEventListener("focus", () => {
      queueMicrotask(() =>
        input.setSelectionRange(input.value.length, input.value.length)
      );
    });

    // retorna número (ex.: "1.234,56" -> 1234.56)
    input.getNumberValue = () => {
      const d = onlyDigitsFromMasked(input.value);
      return d ? Number(d) / 100 : NaN;
    };
  }

  // helper p/ ler número do input (usa a máscara; tem fallback)

  // aplica a máscara nos três campos
  attachBRLMoneyMask(document.getElementById("valor_moto"));
  attachBRLMoneyMask(document.getElementById("valor_entrada"));
  attachBRLMoneyMask(document.getElementById("renda_mensal"));

  // === Sobe os valores da 1ª parte para o PPA global ===
  const vmEl = document.getElementById("valor_moto");
  const veEl = document.getElementById("valor_entrada");

  const commitPPA = () => {
    const vm = numFromInput(vmEl);
    const ve = numFromInput(veEl);
    if (
      Number.isFinite(vm) &&
      Number.isFinite(ve) &&
      vm > 0 &&
      ve >= 0 &&
      ve <= vm
    ) {
      console.log("[PPA] commitPPA: valorMoto=", vm, "entrada=", ve);
      setInitialPPA(vm, ve);
    }
  };

  // na carga, tenta usar o que já tiver no localStorage…
  loadPPA();
  // …mas, se já houver valores digitados na Etapa 4, eles prevalecem
  commitPPA();

  vmEl?.addEventListener("input", () => {
    console.log("[PPA] valorMoto alterado ?", vmEl.value);
    commitPPA();
  });
  veEl?.addEventListener("input", () => {
    console.log("[PPA] entrada alterada ?", veEl.value);
    commitPPA();
  });

  // manter o PPA atualizado enquanto o usuário edita
  vmEl?.addEventListener("input", commitPPA);
  veEl?.addEventListener("input", commitPPA);

  // Substitua todo o seu bloco addEventListener por este:
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Inicia o estado de envio: desabilita botões E MUDA O TEXTO
    setSubmittingState(true, "Enviando...");

    const feedbackArea = document.getElementById("erro_dados_venda");
    feedbackArea.classList.add("hidden");
    feedbackArea.innerHTML = "";

    // Coleta os valores numéricos uma única vez no início
    const valorMoto = numFromInput(document.getElementById("valor_moto"));
    const entrada = numFromInput(document.getElementById("valor_entrada"));
    rendaGlobal = numFromInput(document.getElementById("renda_mensal"));
    localStorage.setItem("rendaGlobal", rendaGlobal);

    // Pequeno atraso para o usuário perceber a mudança no botão
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Executa a PPA com os valores coletados
    const falhas = realizarCalculoPPA(valorMoto, entrada, rendaGlobal);

    // --- FLUXO DE FALHA DA PPA ---
    if (falhas.length > 0) {
      let mensagemHTML =
        '<p style="font-weight: bold;">Pré-Análise Não Concedida.</p>';
      const motivos = obterMotivosDeReprovacao(falhas);

      // --- CORREÇÃO APLICADA AQUI ---
      // Passa os parâmetros corretos que já coletamos para a função de sugestões
      const sugestoes = calcularSugestoes(
        falhas,
        valorMoto,
        entrada,
        rendaGlobal
      );

      const listaMotivos = motivos
        .map((motivo) => `<li> ${motivo}</li>`)
        .join("");
      mensagemHTML += `<ul class="list-none pl-5">${listaMotivos}<br></ul>`;

      if (sugestoes.length > 0) {
        mensagemHTML +=
          '<p style="font-weight: bold">Para ser aprovado, sugerimos que você:</p>';

        if (sugestoes.length == 1) {
          mensagemHTML += `
            <ul class="list-none pl-5">
            <li> ${sugestoes[0]}</li>
            </ul>
            `;
        } else {
          // sempre mostra duas sugestões unidas por "OU"
          mensagemHTML += `
            <ul class="list-none pl-5">
            <li> ${sugestoes[0]} OU</li>
            <li> ${sugestoes[1]}</li>
            </ul>
            `;
        }
      }
      feedbackArea.innerHTML = mensagemHTML;
      feedbackArea.classList.remove("hidden");

      // Restaura o estado e o texto original do botão para "Enviar"
      setSubmittingState(false, "Enviar");

      console.warn("PPA Reprovada! Falhas:", falhas);
      return; // Interrompe a execução aqui
    }

    // --- FLUXO DE SUCESSO DA PPA ---
    console.log("PPA Aprovada! Enviando para o Apps Script...");
    const payload = serializeFormToPayload(form);
    console.log(payload);

    const prePayload = {
      cpf: payload.cpf,
      dealership: payload.loja,
      seller: payload.nome_vendedor,
      credit: valorMoto - entrada,
      income: rendaGlobal,
      down_payment: entrada,
      email: payload.email_cliente,
      phone: payload.telefone,
    };
    console.log(prePayload);

    try {
      // const result = await postToAppsScript(payload);
      const pre = await preAnalysisRequest(prePayload);
      // const pre = { approved: true, discount_40: false };
      const nmCliente = pre.name;
      if (nmCliente) {
        updateFinalPlaceholderValue("nome", nmCliente);
      }

      // if (result && result.ok) {
      if (pre.approved) {
        // Sucesso no envio abre a etapa de sucesso
        limit40Global = pre.discount_40;
        setSubmittingState(false, "Enviar");
        setInitialPPA(valorMoto, entrada);
        localStorage.setItem("v2TelaAtiva", "v2-pagina-aprovado");
        localStorage.removeItem("formFinalAtivo");
        setFlowStage(FLOW_STAGES.SIMULACAO);
        openV2AsPage("v2-pagina-aprovado");
        localStorage.setItem("cpfGlobal", payload.cpf);
        console.log(nmCliente);
      } else {
        // Falha no envio (erro retornado pelo servidor)
        setSubmittingState(false, "Enviar");
        openV2AsPage("v2-pagina-negado");
        return;
      }
    } catch (err) {
      // Falha de comunicação (rede, etc.)
      console.error("Erro na comunicação com Apps Script:", err);
      alert("Ocorreu um erro na comunicação. Tente novamente.");
      setSubmittingState(false, "Enviar");
    }
  });

  /*
   * =================================================================
   * FUNÇÃO UTILITÁRIA DE SPAN EDITÁVEL
   * (VERSÃO OTIMIZADA: Lógica de REAIS + Formatação no "blur" para evitar "lag")
   * =================================================================
   */
  function attachEditableMoneySpan(span, callback, options = {}) {
    if (!span) return;

    // Configuração: Default é SEM R$ e COM 2 decimais (para Etapa 2)
    const config = {
      showCurrency: options.showCurrency ?? false,
      fractionDigits: options.fractionDigits ?? 2,
    };

    // 'digits' agora armazena a string de REAIS (ex: "8000")
    let digits = (span.textContent.match(/\d/g) || []).join("");
    let blurTimeout = null;

    const formatBRL = (reaisString) => {
      const value = Number(reaisString) || 0;

      const styleOptions = {
        minimumFractionDigits: config.fractionDigits,
        maximumFractionDigits: config.fractionDigits,
      };

      if (config.showCurrency) {
        return value.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
          ...styleOptions,
        });
      } else {
        return value.toLocaleString("pt-BR", {
          style: "decimal",
          ...styleOptions,
        });
      }
    };

    const getNumberValue = () => {
      // Retorna o valor em REAIS
      return Math.max(0, Number(digits));
    };

    const render = () => {
      // Só formata se NÃO estiver focado
      if (document.activeElement !== span) {
        span.textContent = formatBRL(digits);
      }
    };

    const showRawDigits = () => {
      // Mostra os dígitos puros (REAIS) para edição
      span.textContent = digits === "0" || digits === "" ? "" : digits;
    };

    span.setAttribute("contenteditable", "true");
    span.style.cursor = "text";
    span.style.minWidth = "3ch";

    span.addEventListener("focus", () => {
      span.style.outline = "2px solid #1D46CE";
      span.style.borderRadius = "4px";
      span.style.paddingLeft = "4px";
      span.style.paddingRight = "4px";

      // !! OTIMIZAÇÃO !!
      // Mostra os dígitos puros (ex: "8000")
      showRawDigits();

      setTimeout(() => {
        const selection = window.getSelection();
        const range = document.createRange();
        if (span.firstChild) range.selectNodeContents(span);
        selection.removeAllRanges();
        selection.addRange(range);
      }, 10);

      clearTimeout(blurTimeout);
    });

    span.addEventListener("blur", () => {
      blurTimeout = setTimeout(() => {
        span.style.outline = "none";
        span.removeAttribute("style");
        span.style.cursor = "text";
        span.style.minWidth = "3ch";

        // !! OTIMIZAÇÃO !!
        // Lê os dígitos puros (REAIS) que o usuário deixou no span
        let newDigits = (span.textContent.match(/\d/g) || []).join("");
        if (newDigits.length === 0) newDigits = "0";
        digits = newDigits; // Atualiza o valor de 'Reais'

        render(); // Formata (ex: "8000,00")

        if (callback) {
          callback(getNumberValue()); // Envia o valor em REAIS (ex: 8000)
        }
      }, 100);
    });

    span.addEventListener("keydown", (e) => {
      // Permite teclas de controle
      if ([8, 46, 9, 27, 13, 37, 38, 39, 40].includes(e.keyCode)) {
        if (e.keyCode === 13) {
          // Enter
          e.preventDefault();
          span.blur();
        }
        return;
      }
      // Só permite números
      if (e.key.length === 1 && !/\d/.test(e.key)) {
        e.preventDefault();
        return;
      }
    });

    // (Removemos o 'keyup' pois ele era a causa do "lag")

    // API externa pra setar valor por número
    span.setNumberValue = (num) => {
      // 'num' é REAIS (ex: 8000)
      digits = String(Math.round(Number(num || 0)));
      render();
    };

    span.getNumberValue = getNumberValue;

    // inicial
    // Na carga, o texto (ex: "8000") é REAIS.
    const initialValue = (span.textContent.match(/\d/g) || []).join("");
    if (initialValue) {
      span.setNumberValue(initialValue);
    } else {
      span.setNumberValue(0);
    }
  }

  /*
   * =================================================================
   * LÓGICA DOS SLIDERS (v2-APROVADO)
   * (VERSÃO FINAL: API Serasa 1x, API Valores a cada movimento)
   * =================================================================
   */

  function initSimuladorV2() {
    // se o usuário ajustar valores na Etapa 4 depois, a V2 atualiza em tempo real
    window.addEventListener("ppa:changed", (e) => {
      const p = e.detail || window.PPA || {};
      // força os novos valores como ponto de partida
      total = Number(p.total) || total;
      entrada = Number(p.entrada) || entrada;

      const tax = window.limit40 ? 0.4 : 0.5;

      const finInit = window.limit40
        ? Math.max(total * tax, total - entrada)
        : Math.min(total * tax, total - entrada);

      // respeita o “teto” (max financiado permitido no primeiro cálculo)
      // const finInit = Math.max(0, total - entrada);
      MAX_FINANCIADO_PERMITIDO = finInit;

      updateFinanceiro("init");
    });

    // 1. Encontra os elementos na tela
    const rTotal = document.getElementById("valor-moto");
    const sTotal = document.getElementById("valor-moto-num");
    const rEntrada = document.getElementById("valor-entrada");
    const sEntrada = document.getElementById("valor-entrada-num");
    const sFin = document.getElementById("valor-financiado-num");

    const btn12x = document.getElementById("btn-parcela-12x");
    const btn24x = document.getElementById("btn-parcela-24x");
    const btn36x = document.getElementById("btn-parcela-36x");

    // Seleção simples de parcelas (1 único lugar)
    const botoesParcelas = [btn12x, btn24x, btn36x].filter(Boolean);
    let parcelaSelecionada = null; // se quiser usar depois no submit

    botoesParcelas.forEach((btn) => {
      btn.addEventListener("click", () => {
        // visual: só 1 ativo
        botoesParcelas.forEach((b) => b.setAttribute("aria-pressed", "false"));
        btn.setAttribute("aria-pressed", "true");

        // guarda seleção (ex.: "btn-parcela-24x" ou só "24")
        parcelaSelecionada = btn.id;
        // Se quiser popular um hidden:
        const hidden = document.getElementById("parcelas-escolhida");
        if (hidden)
          hidden.value = btn.id.replace("btn-parcela-", "").replace("x", "");
      });

      // acessibilidade via teclado
      btn.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          btn.click();
        }
      });

      if (!btn.hasAttribute("tabindex")) btn.tabIndex = 0;
    });

    // ===============================================
    // !! MODO DE TESTE DE PARCELAS (API SERASA) !!
    // (0 = Aleatório)
    // (1 = Mostrar só 36x)
    // (2 = Mostrar 24x e 36x)
    // (3 = Mostrar 12x, 24x e 36x)
    const CASO_TESTE = 3; // <-- MUDE AQUI PARA TESTAR (1, 2, 3 ou 0)
    // ===============================================

    // !! NOVO: Cache das parcelas permitidas !!
    // Guardamos aqui as parcelas que a API Serasa permitiu.
    let parcelasPermitidasCache = [];

    // Se não encontrar os sliders, não faz nada (fail-safe).
    if (!rTotal || !rEntrada || !sFin || !sTotal || !sEntrada || !btn12x) {
      console.warn(
        "Elementos do Simulador V2 não encontrados. Abortando initSimuladorV2."
      );
      return;
    }

    // --- Constantes e Limites ---
    const HARD_MIN_TOTAL = Number(rTotal.dataset.hardMin || rTotal.min || 0);
    const HARD_MIN_ENTRADA = Number(
      rEntrada.dataset.hardMin || rEntrada.min || 0
    );
    const VISUAL_MIN = Number(rTotal.min);
    const VISUAL_MAX = Number(rTotal.max);

    // --- REGRA PPA: O Teto do Financiamento ---
    const totalPPA = Number(window.PPA?.total ?? rTotal.value);
    const entradaPPA = Number(window.PPA?.entrada ?? rEntrada.value);
    const financiadoInicialPPA = Math.max(0, totalPPA - entradaPPA);
    let MAX_FINANCIADO_PERMITIDO = financiadoInicialPPA;

    // --- Variáveis de Estado ---
    let total = totalPPA;
    let entrada = entradaPPA;
    let financiado = 0; // Será definido na inicialização

    // Helper de formatação (Sem R$, com 2 decimais)
    const formatBRL = (num) =>
      (num || 0).toLocaleString("pt-BR", {
        style: "decimal",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    /**
     * Garante que os valores iniciais (PPA) respeitem os mínimos da página atual.
     */
    function clampInitialValues() {
      total = Math.max(total, HARD_MIN_TOTAL);
      entrada = Math.max(entrada, HARD_MIN_ENTRADA);
      if (entrada > total) {
        entrada = total - 50;
      }
    }
    /**
     * Função Cérebro: Aplica todas as regras de negócio em ordem.
     */
    const atualizarValoresParcelasDebounce = debounce(
      atualizarValoresParcelas,
      2000
    ); // Debounce
    function updateFinanceiro(source) {
      // 1. Lê os valores atuais (dos sliders)
      if (source === "total") {
        total = Number(rTotal.value);
      } else if (source === "entrada") {
        entrada = Number(rEntrada.value);
      } else if (source === "span-total") {
        total = Number(rTotal.value);
      } else if (source === "span-entrada") {
        entrada = Number(rEntrada.value);
      }

      // 2. REGRAS (Hard Mins, Entrada <= Total)
      const entradaStep = Number(rEntrada.step) || 1;
      total = Math.max(total, HARD_MIN_TOTAL);
      entrada = Math.min(
        entrada,
        Math.max(HARD_MIN_ENTRADA, total - entradaStep)
      );
      if (entrada > total) {
        entrada = Math.max(HARD_MIN_ENTRADA, total - entradaStep);
      }

      // 3. REGRA 2: "Financiado nunca pode aumentar" (Trava da PPA)
      let financiadoAtual = total - entrada;

      if (financiadoAtual > MAX_FINANCIADO_PERMITIDO) {
        if (source === "total" || source === "span-total") {
          entrada = total - MAX_FINANCIADO_PERMITIDO;
        } else {
          total = entrada + MAX_FINANCIADO_PERMITIDO;
        }
      }

      // 4. RE-VALIDAÇÃO
      total = Math.max(total, HARD_MIN_TOTAL);
      entrada = Math.max(entrada, HARD_MIN_ENTRADA);
      if (entrada > total) {
        entrada = Math.max(HARD_MIN_ENTRADA, total - entradaStep);
      }

      // 5. RECALCULA o financiado final
      financiado = Math.max(0, total - entrada);

      // 6. Chama a UI para atualizar a tela
      updateUI(total, entrada, financiado);

      // !! MUDANÇA !!
      // Apenas atualiza os valores (chamando a futura API de valores)

      localStorage.setItem("downPaymentGlobal", entrada); // ---> Salvando valor da entrada para ser usado na criação do credito
      // Esconder botão de para analise final
      document.getElementById("btn-analise-final").disabled = true;
      document
        .getElementById("btn-analise-final")
        .classList.remove("v2-bg-black");
      document
        .getElementById("btn-analise-final")
        .classList.add("v2-bg-black/50");
      document
        .getElementById("btn-analise-final")
        .classList.remove("v2-cursor-pointer");
      document
        .getElementById("btn-analise-final")
        .classList.remove("v2-cursor-default");

      atualizarValoresParcelasDebounce(financiado); // Esse fica ouvindo os sliders!
      // Relevar botao
    }

    /**
     * Função Visual: Atualiza a Tela (Sliders, Spans, Cores)
     */
    function updateUI(total, entrada, financiado) {
      rTotal.value = total;
      rEntrada.value = entrada;

      if (sTotal?.setNumberValue) sTotal.setNumberValue(total);
      else if (sTotal) sTotal.textContent = formatBRL(total);

      if (sEntrada?.setNumberValue) sEntrada.setNumberValue(entrada);
      else if (sEntrada) sEntrada.textContent = formatBRL(entrada);

      if (sFin) sFin.textContent = formatBRL(financiado);

      // Atualiza o preenchimento
      const range = VISUAL_MAX - VISUAL_MIN;
      const totalPct = (total - VISUAL_MIN) / range || 0;
      rTotal.style.setProperty("--pct", totalPct * 100 + "%");
      const entradaPct = (entrada - VISUAL_MIN) / range || 0;
      rEntrada.style.setProperty("--pct", entradaPct * 100 + "%");
    }

    // ===============================================
    // LÓGICA DE PARCELAS (CORRIGIDA)
    // ===============================================

    /**
     * Simula a chamada à API do Serasa.
     * (CORRIGIDO com as suas regras de teste)
     */
    async function simularAPISerasa() {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Delay

      // Lógica de Teste (seguindo suas regras)
      if (CASO_TESTE === 1) return ["36x"];
      if (CASO_TESTE === 2) return ["24x", "36x"];
      if (CASO_TESTE === 3) return ["12x", "24x", "36x"];

      // Caso 0 (Aleatório)
      const opcoesPossiveis = [["36x"], ["24x", "36x"], ["12x", "24x", "36x"]];
      // Escolhe aleatoriamente um dos 3 cenários
      return opcoesPossiveis[Math.floor(Math.random() * 3)];
    }

    /**
     * (NOVA FUNÇÃO)
     * Apenas atualiza o R$ das parcelas (a futura API de valores).
     * Esta é a função "leve" que o slider vai chamar.
     */
    async function atualizarValoresParcelas(valorFinanciado) {
      // Ask gpt how to debounce
      // (Esta função será chamada a cada movimento do slider)
      // (No futuro, aqui é o local para chamar a API que CALCULA os valores)
      // Request para chamar a API:
      const credit = valorFinanciado;
      const income = Number(localStorage.getItem("rendaGlobal")) || 0;
      if (income == 0) return;
      if (
        document
          .getElementById("v2-pagina-aprovado")
          .classList.contains("v2-hidden")
      )
        return;
      const loanPayload = {
        credit: credit,
        income: income,
      };
      const loan = await calculateLoanRequest(loanPayload);
      // Put a blur in the page
      // Salvando os valores para serem usados na criação do credito
      localStorage.setItem("creditGlobal", credit);

      atualizarUnicaParcela(btn12x, loan.installment_12, "12x");
      atualizarUnicaParcela(btn24x, loan.installment_24, "24x");
      atualizarUnicaParcela(btn36x, loan.installment_36, "36x");
      console.log("Botao revelado");
      document.getElementById("btn-analise-final").disabled = false;
      document
        .getElementById("btn-analise-final")
        .classList.remove("v2-bg-black/50");
      document.getElementById("btn-analise-final").classList.add("v2-bg-black");
      document
        .getElementById("btn-analise-final")
        .classList.remove("v2-cursor-default");
      document
        .getElementById("btn-analise-final")
        .classList.add("v2-cursor-pointer");

      function atualizarUnicaParcela(botao, valor, chave) {
        if (!parcelasPermitidasCache.includes(chave) || valor === 0) {
          botao.classList.add("v2-hidden");
          const span = botao.querySelector(".valor-parcela");
          if (span) span.textContent = "R$ --,--";
          return;
        }

        botao.classList.remove("v2-hidden");
        const span = botao.querySelector(".valor-parcela");
        if (span) span.textContent = `R$ ${valor.toFixed(2)}`;
      }

      // 4. Atualiza os botões permitidos (lendo do Cache)
      // if (parcelasPermitidasCache.includes('12x')) {
      //     const span = btn12x.querySelector('.valor-parcela');
      //     if(span) span.textContent = placeholderValor;
      // }
      //
      // if (parcelasPermitidasCache.includes('24x')) {
      //     const span = btn24x.querySelector('.valor-parcela');
      //     if(span) span.textContent = placeholderValor;
      // }
      //
      // if (parcelasPermitidasCache.includes('36x')) {
      //     const span = btn36x.querySelector('.valor-parcela');
      //     if(span) span.textContent = placeholderValor;
      // }
    }

    /**
     * (NOVA FUNÇÃO)
     * Chama a API Serasa (1x) e define quais botões ficarão visíveis.
     */
    async function carregarParcelasDaAPI() {
      // 1. Reset: Esconde todos os botões (apenas por segurança)
      [btn12x, btn24x, btn36x].forEach((btn) => btn.classList.add("v2-hidden"));

      // 2. Chama a API Serasa (visibilidade) e guarda no Cache
      parcelasPermitidasCache = await simularAPISerasa();

      // 3. Mostra os botões permitidos (ordem de visibilidade crescente)
      if (parcelasPermitidasCache.includes("12x")) {
        btn12x.classList.remove("v2-hidden");
      }
      if (parcelasPermitidasCache.includes("24x")) {
        btn24x.classList.remove("v2-hidden");
      }
      if (parcelasPermitidasCache.includes("36x")) {
        btn36x.classList.remove("v2-hidden");
      }

      // 4. Agora, calcula o valor inicial
      // (A variável 'financiado' já foi definida pelo 'updateFinanceiro('init')')
      atualizarValoresParcelas(financiado); // Aqui é chamado no momento em que entra na página
    }

    // ===============================================
    // FIM DA LÓGICA DE PARCELAS
    // ===============================================

    // --- Listeners: Gatilhos de Evento ---
    rTotal.addEventListener("input", () => updateFinanceiro("total"));
    rEntrada.addEventListener("input", () => updateFinanceiro("entrada"));

    // Liga os Spans
    if (typeof attachEditableMoneySpan === "function") {
      attachEditableMoneySpan(
        sTotal,
        (novoTotal) => {
          rTotal.value = novoTotal;
          updateFinanceiro("span-total");
        },
        { showCurrency: false, fractionDigits: 2 }
      );

      attachEditableMoneySpan(
        sEntrada,
        (novaEntrada) => {
          rEntrada.value = novaEntrada;
          updateFinanceiro("span-entrada");
        },
        { showCurrency: false, fractionDigits: 2 }
      );
    } else {
      console.warn("Função attachEditableMoneySpan não encontrada.");
    }

    // --- Inicialização ---
    clampInitialValues();
    updateFinanceiro("init"); // Roda 1x para definir os valores de 'total', 'entrada' e 'financiado'
    console.log("[Simulador] Inicio", {
      total,
      entrada,
      financiado,
      teto: MAX_FINANCIADO_PERMITIDO,
    });

    // !! MUDANÇA !!
    // Chama a API Serasa (1x) e mostra os botões corretos
    carregarParcelasDaAPI();
  }
  // Inicializa os sliders da V2 assim que este script carregar
  if (document.getElementById("v2-pagina-aprovado")) {
    initSimuladorV2();
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".v2-btnreiniciar");
    if (!btn) return;

    console.log("btn-reiniciar clicado");

    resetFlowState();
    localStorage.clear();
    sessionStorage.clear();
    location.reload();
  });

  // ============================
  // FORM FINAL - NAVEGAÇÃO E EXIBIÇÃO (com persistência)
  // ============================
  window.addEventListener("DOMContentLoaded", () => {
    const btnAnaliseFinal = document.getElementById("btn-analise-final");
    const finalTabs = Array.from(document.querySelectorAll(".final-step-tab"));

    const populateFinalPlaceholders = () => {
      const updates = {};
      FINAL_PLACEHOLDER_MAP.forEach(({ key, source, target }) => {
        const targetEl = document.querySelector(target);
        if (!targetEl) return;
        let value = "";
        if (key === "nome" && nomeClienteFromApi) {
          value = nomeClienteFromApi;
        } else {
          const sourceEl = document.querySelector(source);
          value = sourceEl?.value?.trim() ?? "";
          if (!value) {
            value = getFinalPlaceholderValue(key);
          }
        }
        if (value) {
          targetEl.placeholder = value;
          updates[key] = value;
        } else {
          targetEl.placeholder = "";
        }
      });
      if (Object.keys(updates).length > 0) {
        saveFinalPlaceholderData(updates);
      }
    };

    const ensureFinalStepVisible = (stepId) => {
      FINAL_STEP_IDS.forEach((id) => {
        const section = document.getElementById(id);
        if (!section) return;
        const active = id === stepId;
        section.classList.toggle("v2-hidden", !active);
        section.classList.toggle("v2-is-active", active);
        section.classList.toggle("is-active", active);
      });
    };

    function openFormFinal(options = {}) {
      document.body.classList.add("v2-mode");
      document.body.classList.remove("bg-brand");
      const { restoreStep = false } = options;
      const v1Shell = document.querySelector(".v1-shell");
      const formFinalSection = document.getElementById("form-final");
      const aprovadoPage = document.getElementById("v2-pagina-aprovado");
      const negadoPage = document.getElementById("v2-pagina-negado");

      v1Shell?.classList.add("v2-hidden");
      aprovadoPage?.classList.add("v2-hidden");
      negadoPage?.classList.add("v2-hidden");

      if (formFinalSection) {
        formFinalSection.classList.remove("v2-hidden");
        localStorage.setItem("formFinalAtivo", "true");
        localStorage.removeItem("v2TelaAtiva");
        setFlowStage(FLOW_STAGES.FORMULARIO_FINAL);

        let targetStepId = localStorage.getItem("formFinalStep");
        if (!restoreStep || !FINAL_STEP_IDS.includes(targetStepId)) {
          targetStepId = FINAL_STEP_IDS[0];
          localStorage.setItem("formFinalStep", targetStepId);
        }

        ensureFinalStepVisible(targetStepId);
        populateFinalPlaceholders();
        window.MotoCredFlow?.restoreFinalFormData?.();
        document.dispatchEvent(
          new CustomEvent("finalStepJump", { detail: targetStepId })
        );
      }
    }

    window.MotoCredFlow = window.MotoCredFlow || {};
    window.MotoCredFlow.openFormFinal = openFormFinal;

    finalTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetStepId = tab.dataset.finalStep;
        if (!targetStepId || tab.disabled) return;
        document.dispatchEvent(
          new CustomEvent("finalStepTabRequest", { detail: targetStepId })
        );
      });
    });

    if (btnAnaliseFinal) {
      btnAnaliseFinal.addEventListener("click", async function () {
        const activatedInstallmentBtn = document.querySelector(
          '[aria-pressed="true"]'
        );
        if (!activatedInstallmentBtn) return 0;
        const chousenInstallmentAmount = parseInt(
          activatedInstallmentBtn.id.replace("btn-parcela-", ""),
          10
        );

        const createLoanPayload = {
          cpf: localStorage.getItem("cpfGlobal"),
          down_payment: localStorage.getItem("downPaymentGlobal"),
          credit: localStorage.getItem("creditGlobal"),
          chousen_installment_amount: chousenInstallmentAmount,
        };

        console.log(createLoanPayload);
        const createdLoan = await createLoanRequest(createLoanPayload);
        console.log(createdLoan);

        openFormFinal({ restoreStep: false });
      });
    }
  });

  // ==========================================
  // ?? PERSISTÊNCIA DA TELA ATUAL (Simulação / Negado)
  // ==========================================
  window.addEventListener("beforeunload", () => {
    // guarda qual tela V2 está ativa no momento
    const ativo = !document
      .getElementById("v2-pagina-aprovado")
      ?.classList.contains("v2-hidden")
      ? "v2-pagina-aprovado"
      : !document
          .getElementById("v2-pagina-negado")
          ?.classList.contains("v2-hidden")
      ? "v2-pagina-negado"
      : null;

    if (ativo) {
      localStorage.setItem("v2TelaAtiva", ativo);
    } else {
      localStorage.removeItem("v2TelaAtiva");
    }
  });

  // ============================
  // FORM FINAL - NAVEGAÇÃO ENTRE ETAPAS INTERNAS (por ID)
  // ============================
  window.addEventListener("DOMContentLoaded", () => {
    const formFinal = document.getElementById("formFinal");
    if (!formFinal) return;

    const finalNavPrev = document.querySelector("#form-final .nav-prev");
    const finalNavNext = document.querySelector("#form-final .nav-next");
    const finalTabsNav = document.querySelectorAll(".final-step-tab");
    const originalNextText = finalNavNext?.textContent;
    const finalSection = document.querySelector("#form-final");
    const finalInputs =
      finalSection?.querySelectorAll("input, select, textarea") || [];

    const setFinalSubmittingState = (isSubmitting) => {
      finalInputs.forEach((field) => {
        if (isSubmitting) {
          field.dataset.wasDisabled = field.disabled ? "true" : "false";
          field.disabled = true;
        } else if (field.dataset.wasDisabled !== "true") {
          field.disabled = false;
        }
      });

      finalNavPrev.disabled = isSubmitting;
      finalNavNext.disabled = isSubmitting;

      finalTabsNav.forEach((tab) => {
        tab.disabled = isSubmitting;
        tab.setAttribute("aria-disabled", isSubmitting ? "true" : "false");
      });

      if (finalNavNext) {
        finalNavNext.textContent = isSubmitting
          ? "Enviando..."
          : originalNextText;
      }
    };

    formFinal.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!ensureDocumentFilesSelected()) return;
      setFinalSubmittingState(true);
      console.log("submeteu");

      try {
        console.log("tentando enviar analise final");
        const resposta = await enviarFinalAnalise(formFinal);
        console.log("Resposta:", resposta);
        document.getElementById("form-final").classList.add("v2-hidden");
        document.getElementById("pagina-final").classList.remove("v2-hidden");
        localStorage.clear();
        resetFlowState();
        setFlowStage(FLOW_STAGES.FORMULARIO_INICIAL);
        document.getElementById("form-final")?.classList.add("v2-hidden");
        document.getElementById("pagina-final")?.classList.remove("v2-hidden");

        // aqui depois dá feedback ao usuário ou avança para a próxima tela
      } catch (err) {
        console.error("Falha ao enviar formulário final", err);
        // opcional: mostrar erro na UI
      } finally {
        setFinalSubmittingState(false);
      }
    });

    const persistableFields = Array.from(
      formFinal.querySelectorAll("input, select, textarea")
    ).filter((field) => field.name && !field.disabled && field.type !== "file");
    const referenceCpfInputs = Array.from(
      formFinal.querySelectorAll('input[id^="cpf_referencia_"]')
    );
    const documentFileInputs = Array.from(
      formFinal.querySelectorAll('#final_documentacao input[type="file"]')
    );

    const normalizeReferenceCpfValue = (input) => {
      if (!input) return "";
      const digits = sanitizeCpf(input.value || "");
      input.value = formatCpf(digits);
      return digits;
    };

    const updateReferenceCpfValidity = (input, showMessage = false) => {
      if (!input || input.disabled) {
        return true;
      }
      const digits = normalizeReferenceCpfValue(input);
      if (!digits) {
        input.setCustomValidity("");
        return true;
      }
      const isValid = isValidCpfDigits(digits);
      if (!isValid) {
        input.setCustomValidity(showMessage ? "Informe um CPF válido." : "");
        return false;
      }
      input.setCustomValidity("");
      return true;
    };

    referenceCpfInputs.forEach((input) => {
      normalizeReferenceCpfValue(input);
      updateReferenceCpfValidity(input, false);
      input.addEventListener("input", () => {
        normalizeReferenceCpfValue(input);
        updateReferenceCpfValidity(input, false);
      });
      input.addEventListener("blur", () => {
        normalizeReferenceCpfValue(input);
        updateReferenceCpfValidity(input, true);
      });
    });

    const hasAllDocumentFiles = () =>
      documentFileInputs.length === 0 ||
      documentFileInputs.every(
        (input) => input.files && input.files.length > 0
      );

    documentFileInputs.forEach((input) => {
      input.addEventListener("change", () => {
        input.setCustomValidity("");
      });
    });

    const ensureDocumentFilesSelected = () => {
      if (hasAllDocumentFiles()) return true;

      const firstMissing = documentFileInputs.find(
        (input) => !input.files || input.files.length === 0
      );

      if (firstMissing) {
        firstMissing.setCustomValidity("Selecione um arquivo.");
        firstMissing.reportValidity();
      }

      const docIndex = FINAL_STEP_IDS.indexOf("final_documentacao");
      if (docIndex >= 0) {
        goToStep(docIndex);
        setTimeout(() => firstMissing?.focus({ preventScroll: false }), 150);
      }
      return false;
    };

    const saveFinalFormData = () => {
      const data = {};
      persistableFields.forEach((field) => {
        if (field.type === "checkbox") {
          data[field.name] = field.checked;
        } else if (field.type === "radio") {
          if (field.checked) {
            data[field.name] = field.value;
          } else if (!(field.name in data)) {
            data[field.name] = null;
          }
        } else {
          data[field.name] = field.value;
        }
      });
      try {
        localStorage.setItem(FINAL_FORM_STORAGE_KEY, JSON.stringify(data));
      } catch (err) {
        console.warn("[FormFinal] Falha ao salvar dados", err);
      }
    };

    const restoreFinalFormData = () => {
      try {
        const stored = localStorage.getItem(FINAL_FORM_STORAGE_KEY);
        if (!stored) return;
        const data = JSON.parse(stored);
        if (!data || typeof data !== "object") return;

        persistableFields.forEach((field) => {
          const storedValue = data[field.name];
          if (storedValue === undefined || storedValue === null) {
            if (field.type === "checkbox" || field.type === "radio") {
              field.checked = false;
            } else {
              field.value = "";
            }
            return;
          }

          if (field.type === "checkbox") {
            field.checked = Boolean(storedValue);
          } else if (field.type === "radio") {
            field.checked = field.value === storedValue;
          } else {
            field.value = storedValue;
          }
        });
      } catch (err) {
        console.warn("[FormFinal] Falha ao restaurar dados", err);
      }
    };

    const finalTabs = Array.from(document.querySelectorAll(".final-step-tab"));
    const finalStepLabel = document.querySelector(".final-step-current-label");

    window.MotoCredFlow = window.MotoCredFlow || {};
    window.MotoCredFlow.restoreFinalFormData = restoreFinalFormData;

    // ordem explícita das seções
    const stepOrder = FINAL_STEP_IDS.slice();

    // cache dos elementos
    const steps = stepOrder
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    const btnPrev = document.querySelector("#form-final .nav-prev");
    const btnNext = document.querySelector("#form-final .nav-next");

    let currentStep = 0;
    let finalMaxStep = 0;

    const updateFinalStepperUI = () => {
      finalTabs.forEach((tab, idx) => {
        const isActive = idx === currentStep;
        const isComplete = idx < finalMaxStep;
        const enabled = idx <= finalMaxStep;
        tab.classList.toggle("is-active", isActive);
        tab.classList.toggle("is-complete", isComplete && !isActive);
        tab.disabled = !enabled;
        tab.setAttribute("aria-disabled", enabled ? "false" : "true");
        tab.tabIndex = enabled ? 0 : -1;
      });

      if (finalStepLabel) {
        const activeTab = finalTabs[currentStep];
        finalStepLabel.textContent =
          activeTab?.dataset.label ||
          activeTab?.getAttribute("aria-label") ||
          "";
      }
    };

    function showStepById(stepId) {
      steps.forEach((el) => {
        const active = el.id === stepId;
        el.classList.toggle("v2-hidden", !active);
        el.classList.toggle("v2-is-active", active);
        el.classList.toggle("is-active", active);
      });
      localStorage.setItem("formFinalStep", stepId);
      const idx = stepOrder.indexOf(stepId);
      btnPrev.disabled = idx <= 0;
      btnNext.textContent = idx === stepOrder.length - 1 ? "Enviar" : "Próximo";
    }

    function goToStep(index) {
      index = Math.max(0, Math.min(index, stepOrder.length - 1));
      const targetId = stepOrder[index];
      if (targetId) showStepById(targetId);
      currentStep = index;
      const finalNavPrev = document.querySelector("#form-final .nav-prev");
      finalNavPrev?.classList.toggle("v2-opacity-0", currentStep === 0);
      finalNavPrev?.classList.toggle(
        "v2-pointer-events-none",
        currentStep === 0
      );

      finalMaxStep = Math.max(finalMaxStep, currentStep);
      updateFinalStepperUI();
    }

    // ?? restaura etapa salva
    const savedId = localStorage.getItem("formFinalStep");
    const startIndex = savedId ? stepOrder.indexOf(savedId) : 0;
    goToStep(startIndex >= 0 ? startIndex : 0);

    function validateFinalStep(stepId) {
      const stepEl = document.getElementById(stepId);
      if (!stepEl) return true;
      const fields = Array.from(
        stepEl.querySelectorAll("input, select, textarea")
      ).filter((field) => !field.disabled);

      for (const field of fields) {
        if (referenceCpfInputs.includes(field)) {
          updateReferenceCpfValidity(field, true);
        }
        if (!field.checkValidity()) {
          field.reportValidity();
          field.focus({ preventScroll: false });
          return false;
        }
      }
      return true;
    }

    persistableFields.forEach((field) => {
      const eventName =
        field.type === "checkbox" || field.type === "radio"
          ? "change"
          : "input";
      field.addEventListener(eventName, saveFinalFormData);
    });

    restoreFinalFormData();

    // eventos dos botões

    btnNext?.addEventListener("click", () => {
      const currentStepId = stepOrder[currentStep];
      if (!validateFinalStep(currentStepId)) return;

      if (currentStep === stepOrder.length - 1) {
        if (!ensureDocumentFilesSelected()) return;
        formFinal.requestSubmit();
        console.log("envio");

        return;
      }

      goToStep(currentStep + 1);
    });

    btnPrev?.addEventListener("click", () => {
      if (currentStep > 0) {
        goToStep(currentStep - 1);
      }
    });

    document.addEventListener("finalStepTabRequest", (event) => {
      const targetId = event.detail;
      const targetIndex = stepOrder.indexOf(targetId);
      if (targetIndex >= 0 && targetIndex <= finalMaxStep) {
        goToStep(targetIndex);
      }
    });

    document.addEventListener("finalStepJump", (event) => {
      const targetId = event.detail;
      const targetIndex = stepOrder.indexOf(targetId);
      if (targetIndex >= 0) {
        goToStep(targetIndex);
      }
    });
  });

  //to so mexendo para ver na tela, pode apagar essa linha para fazer seu back definir true/false
  window.aprovado40Flag = false;

  //mostra tela de simulação normal ou flag de entrada 50%
  window.addEventListener("DOMContentLoaded", () => {
    const alertEntrada = document.getElementById("alert-entrada-50");
    const mensagemEntrada40 = document.getElementById("entrada40");
    if (!alertEntrada) return;

    //determina qual mensagem aparece (a normal ou do reajuste)
    const updateVisibility = (flag) => {
      const aprovado = flag === true;
      if (aprovado) {
        alertEntrada.classList.add("v2-hidden");
        mensagemEntrada40?.classList.remove("v2-hidden");
      } else {
        alertEntrada.classList.remove("v2-hidden");
        mensagemEntrada40?.classList.add("v2-hidden");
      }
    };

    const closeEntradaBtn = alertEntrada.querySelector(".entrada-alert__close");
    closeEntradaBtn?.addEventListener("click", () => {
      alertEntrada.classList.add("v2-hidden");
    });

    // BACK-END: defina window.aprovado40Flag = true/false antes deste script carregar.
    updateVisibility(window.aprovado40Flag);
  });

  //abre o form final
  window.addEventListener("DOMContentLoaded", () => {
    const stage = getFlowStage();

    // localStorage.removeItem('v2TelaAtiva');
    const ultimaTela = localStorage.getItem("v2TelaAtiva");
    const ensureFinalRestored = () => {
      if (window.MotoCredFlow?.openFormFinal) {
        window.MotoCredFlow.openFormFinal({ restoreStep: true });
      } else {
        setTimeout(ensureFinalRestored, 150);
      }
    };

    //corrigindo um bug da tela final abrindo na simulação
    const shouldRestoreFormFinal =
      stage === FLOW_STAGES.FORMULARIO_FINAL ||
      (stage === FLOW_STAGES.SIMULACAO &&
        localStorage.getItem("formFinalAtivo") === "true");

    if (shouldRestoreFormFinal) {
      ensureFinalRestored();
      return;
    }

    if (stage === FLOW_STAGES.SIMULACAO) {
      document.getElementById("form-final")?.classList.add("v2-hidden");
      localStorage.removeItem("formFinalAtivo");
      if (
        ultimaTela === "v2-pagina-aprovado" ||
        ultimaTela === "v2-pagina-negado"
      ) {
        openV2AsPage(ultimaTela);
      } else {
        setFlowStage(FLOW_STAGES.FORMULARIO_INICIAL);
      }
      return;
    }

    const v1Shell = document.querySelector(".v1-shell");
    v1Shell?.classList.remove("v2-hidden");
    const mainCard = document.querySelector(".card");
    if (mainCard) mainCard.style.display = "";
    document.getElementById("v2-pagina-aprovado")?.classList.add("v2-hidden");
    document.getElementById("v2-pagina-negado")?.classList.add("v2-hidden");
    document.getElementById("form-final")?.classList.add("v2-hidden");
    localStorage.removeItem("formFinalAtivo");
    localStorage.removeItem("v2TelaAtiva");
    setFlowStage(FLOW_STAGES.FORMULARIO_INICIAL);
  });
})(); // ?? FIM DA IIFE GERAL (FINAL DO ARQUIVO)

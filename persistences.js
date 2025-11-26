export let initialFormData = {}
export let finalPlaceholderData = {};
export const INITIAL_FORM_STORAGE_KEY = 'formCadastroData';
export const FINAL_PLACEHOLDER_STORAGE_KEY = 'formFinalPlaceholderData';

export function persistInitialFormStorage() {
  try {
    localStorage.setItem(INITIAL_FORM_STORAGE_KEY, JSON.stringify(initialFormData));
  } catch (err) {
    console.warn('[FormCadastro] Falha ao salvar dados', err);
  }
}

export function loadInitialFormStorage() {
  try {
    const stored = localStorage.getItem(INITIAL_FORM_STORAGE_KEY);
    initialFormData = stored ? JSON.parse(stored) || {} : {};
  } catch (err) {
    initialFormData = {};
    console.warn('[FormCadastro] Falha ao ler dados', err);
  }
  return initialFormData;
}

export function saveInitialFormFieldValue(name, value) {
  if (!name) return;
  if (!initialFormData || typeof initialFormData !== 'object') {
    initialFormData = {};
  }
  initialFormData[name] = value;
  persistInitialFormStorage();
}

export function loadFinalPlaceholderData() {
  try {
    const stored = localStorage.getItem(FINAL_PLACEHOLDER_STORAGE_KEY);
    finalPlaceholderData = stored ? JSON.parse(stored) || {} : {};
  } catch (err) {
    finalPlaceholderData = {};
    console.warn('[FormFinal] Falha ao ler placeholders', err);
  }
  return finalPlaceholderData;
}

export function saveFinalPlaceholderData(partial = {}) {
  if (!partial || typeof partial !== 'object') return;
  finalPlaceholderData = { ...finalPlaceholderData, ...partial };
  try {
    localStorage.setItem(FINAL_PLACEHOLDER_STORAGE_KEY, JSON.stringify(finalPlaceholderData));
  } catch (err) {
    console.warn('[FormFinal] Falha ao salvar placeholders', err);
  }
}

export function getFinalPlaceholderValue(key) {
  if (!finalPlaceholderData || typeof finalPlaceholderData !== 'object') return '';
  return finalPlaceholderData[key] || '';
}

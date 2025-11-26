export const FLOW_STAGE_KEY = 'motocredFlowStage';
export const FLOW_STAGES = {
  FORMULARIO_INICIAL: 'formulario_inicial',
  SIMULACAO: 'simulacao',
  FORMULARIO_FINAL: 'formulario_final'
};

export function setFlowStage(stage) {
  try {
    localStorage.setItem(FLOW_STAGE_KEY, stage);
  } catch (err) {
    console.warn('[Flow] Falha ao salvar estágio', err);
  }
}

export function getFlowStage() {
  try {
    return localStorage.getItem(FLOW_STAGE_KEY) || FLOW_STAGES.FORMULARIO_INICIAL;
  } catch (err) {
    console.warn('[Flow] Falha ao ler estágio', err);
    return FLOW_STAGES.FORMULARIO_INICIAL;
  }
}

export function setInitialPPA(total, entrada) {
  const t = Number(total) || 0;
  const e = Number(entrada) || 0;
  const f = Math.max(0, t - e);
  window.PPA = { total: t, entrada: e, financiado: f };
  console.log('[PPA] setInitialPPA ?', window.PPA);
  try { localStorage.setItem('ppa', JSON.stringify(window.PPA)); } catch (err) {
    console.warn('[PPA] Erro ao salvar localStorage', err);
  }
  window.dispatchEvent(new CustomEvent('ppa:changed', { detail: window.PPA }));
}

export function loadPPA() {
  try {
    const p = JSON.parse(localStorage.getItem('ppa'));
    console.log('[PPA] loadPPA ?', p);
    if (p && Number.isFinite(p.total) && Number.isFinite(p.entrada)) {
      window.PPA = {
        total: Number(p.total),
        entrada: Number(p.entrada),
        financiado: Math.max(0, Number(p.total) - Number(p.entrada))
      };
    }
  } catch (err) {
    console.warn('[PPA] Erro ao ler localStorage', err);
  }
}



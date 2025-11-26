export function numFromInput(el) {
  if (!el) return NaN;
  if (typeof el.getNumberValue === 'function') return el.getNumberValue();
  const raw = String(el.value || '').replace(/\./g, '').replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

export function serializeFormToPayload(form) {
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

    // ? manter só estas 3 linhas
    renda_mensal: numFromInput(document.getElementById('renda_mensal')),
    valor_moto:   numFromInput(document.getElementById('valor_moto')),
    valor_entrada:numFromInput(document.getElementById('valor_entrada')),
  };
}

export function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay);
  }
}

export function serializePayloadFinal(formFinal) {
  const get = (name) => form.elements[name]?.value?.trim() ?? "";

  const referencia_1 = 
    `${get("nome_referencia_1")} - ${get("telefone_referencia_1")} - ${get("parentesco_referencia_1")}`;

  const referencia_2 = 
  `${get("nome_referencia_2")} - ${get("telefone_referencia_2")} - ${get("parentesco_referencia_2")}`;

  const referencia_3 = 
  `${get("nome_referencia_3")} - ${get("telefone_referencia_3")} - ${get("parentesco_referencia_3")}`;

  const referencia_4 = 
  `${get("nome_referencia_4")} - ${get("telefone_referencia_4")} - ${get("parentesco_referencia_4")}`;

  const referencia_5 = 
  `${get("nome_referencia_5")} - ${get("telefone_referencia_5")} - ${get("parentesco_referencia_5")}`;

  return {
    nome_cliente: get("nome_cliente"),
    cpf: get("cpf"),
    estado_civil: get("estado_civil"),
    tipo_residencia: get("residencia"),
    tempo_residencia: get("tempo_residencia"),
    referencia_1: referencia_1,
    referencia_2: referencia_2,
    referencia_3: referencia_3,
    referencia_4: referencia_4,
    referencia_5: referencia_5,
  };
}
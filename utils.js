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


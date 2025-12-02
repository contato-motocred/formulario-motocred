import { getFinalPlaceholderValue } from "./persistences.js";

export function numFromInput(el) {
  if (!el) return NaN;
  if (typeof el.getNumberValue === "function") return el.getNumberValue();
  const raw = String(el.value || "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

export function serializeFormToPayload(form) {
  const get = (name) => form.elements[name]?.value?.trim() ?? "";
  const tipoUsuario = get("tipo_usuario");
  const lojaValue = tipoUsuario === "comprador" ? "--" : get("loja") || "";
  const vendedorValue =
    tipoUsuario === "comprador" ? "--" : get("nome_vendedor") || "";
  const emailVendedorValue =
    tipoUsuario === "comprador" ? "--" : get("email_vendedor") || "";

  return {
    submission_id: get("submission_id"),
    tipo_usuario: get("tipo_usuario"),
    loja: lojaValue,
    nome_vendedor: vendedorValue,
    email_vendedor: emailVendedorValue,
    nome_cliente: get("nome_cliente"),
    cpf: get("cpf"),
    cnh: get("cnh"),
    email_cliente: get("email_cliente"),
    telefone: get("telefone"),

    // ? manter só estas 3 linhas
    renda_mensal: numFromInput(document.getElementById("renda_mensal")),
    valor_moto: numFromInput(document.getElementById("valor_moto")),
    valor_entrada: numFromInput(document.getElementById("valor_entrada")),
  };
}

export function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// export function serializePayloadReferencias(formFinal) {
//   const get = (name) => formFinal.elements[name]?.value?.trim() ?? "";

//   return {
//     nome_cliente: getFinalPlaceholderValue("nome"),
//     cpf: getFinalPlaceholderValue("cpf"),
//     referencia_1: referencia_1,
//     referencia_2: referencia_2,
//     referencia_3: referencia_3,
//     referencia_4: referencia_4,
//     referencia_5: referencia_5,
//   };
// }

export function serializePayloadFormFinal(formFinal) {
  const get = (name) => formFinal.elements[name]?.value?.trim() ?? "";

  const referencia_1 = {
    name: get("nome_referencia_1"),
    phone: get("telefone_referencia_1"),
    relative: get("parentesco_referencia_1"),
  };

  const referencia_2 = {
    name: get("nome_referencia_2"),
    phone: get("telefone_referencia_2"),
    relative: get("parentesco_referencia_2"),
  };

  const referencia_3 = {
    name: get("nome_referencia_3"),
    phone: get("telefone_referencia_3"),
    relative: get("parentesco_referencia_3"),
  };

  const referencia_4 = {
    name: get("nome_referencia_4"),
    phone: get("telefone_referencia_4"),
    relative: get("parentesco_referencia_4"),
  };

  const referencia_5 = {
    name: get("nome_referencia_5"),
    phone: get("telefone_referencia_5"),
    relative: get("parentesco_referencia_5"),
  };

  return {
    cpf: getFinalPlaceholderValue("cpf"),
    marital_status: get("estado_civil"),
    residence_type: get("residencia"),
    residence_time: get("tempo_residencia"),
    occupation: get("profissao"),
    reference1: referencia_1,
    reference2: referencia_2,
    reference3: referencia_3,
    reference4: referencia_4,
    reference5: referencia_5,
  };
}

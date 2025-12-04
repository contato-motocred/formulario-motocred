const API_URL = "https://www.motocred.digital";

export async function preAnalysisRequest(data) {
  try {
    const response = await fetch(`${API_URL}/pre-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cpf: data.cpf,
        email: data.email,
        phone: data.phone,
        income: data.income,
        down_payment: data.down_payment,
        credit: data.credit,
        seller: data.seller,
        dealership: data.dealership,
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
    // { "approved": true, "down_payment_40": true, "installment_12": 0, "installment_24": 0, "installment_36": 0 }
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
}

export async function calculateLoanRequest(data) {
  try {
    const response = await fetch(`${API_URL}/loan/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credit: data.credit,
        income: data.income,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
    // { "installment_12": 0, "installment_24": 0, "installment_36": 0 }
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
}

export async function createLoanRequest(data) {
  try {
    const response = await fetch(`${API_URL}/loan/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cpf: data.cpf,
        down_payment: data.down_payment,
        credit: data.credit,
        chousen_installment_amount: data.chousen_installment_amount,
      }),
    });

    // { "cpf": "string", "down_payment": 0, "credit": 0, "chousen_installment_amount": 0 }
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json(); // {6: 1000.00, 12: 600.00, 24: ...}
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
}

export async function analiseFinal(payload) {
  const res = await fetch(`${API_URL}/final-analysis`, {
    method: "POST",
    body: payload,
  });

  if (!res.ok) {
    throw new Error(`HTTP error! Status: ${res.status}`);
  }

  return res;
}

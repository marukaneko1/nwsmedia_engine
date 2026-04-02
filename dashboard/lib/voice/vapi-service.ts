const VAPI_BASE = "https://api.vapi.ai";

function getHeaders() {
  const key = process.env.VAPI_API_KEY;
  if (!key) throw new Error("VAPI_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function vapiRequest(method: string, path: string, body?: unknown) {
  const res = await fetch(`${VAPI_BASE}${path}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`VAPI ${method} ${path} failed (${res.status}): ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function createAssistant(config: Record<string, unknown>) {
  return vapiRequest("POST", "/assistant", config);
}

export async function updateAssistant(id: string, config: Record<string, unknown>) {
  return vapiRequest("PATCH", `/assistant/${id}`, config);
}

export async function deleteAssistant(id: string) {
  return vapiRequest("DELETE", `/assistant/${id}`);
}

export async function getAssistant(id: string) {
  return vapiRequest("GET", `/assistant/${id}`);
}

export async function listCalls(assistantId?: string, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (assistantId) params.set("assistantId", assistantId);
  return vapiRequest("GET", `/call?${params}`);
}

export async function getCall(id: string) {
  return vapiRequest("GET", `/call/${id}`);
}

export async function listPhoneNumbers() {
  return vapiRequest("GET", "/phone-number");
}

export async function createPhoneNumber(assistantId: string) {
  return vapiRequest("POST", "/phone-number", { provider: "vapi", assistantId });
}

export async function createOutboundCall(config: Record<string, unknown>) {
  return vapiRequest("POST", "/call", config);
}

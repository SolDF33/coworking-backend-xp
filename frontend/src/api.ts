export interface Tokens {
  token: string;
  refreshToken: string;
}

export interface Perfil {
  mensaje: string;
  tuId: string;
  tuRol: 'USER' | 'EDITOR' | 'ADMIN';
  saldoCreditos: number;
}

export interface Sala {
  id: string;
  nombre: string;
  descripcion: string;
  capacidad: number;
}

export interface Reserva {
  id: string;
  usuarioId: string;
  sala: string;
  fecha: string;
  costoCreditos: number;
  estado: 'Confirmada' | 'Cancelada';
}

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';
const TOKEN_KEY = 'coworking.tokens';
let refreshInFlight: Promise<Tokens> | null = null;

export const readTokens = (): Tokens | null => {
  const stored = sessionStorage.getItem(TOKEN_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as Tokens;
  } catch {
    sessionStorage.removeItem(TOKEN_KEY);
    return null;
  }
};

export const saveTokens = (tokens: Tokens): void => {
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
};

export const clearTokens = (): void => {
  sessionStorage.removeItem(TOKEN_KEY);
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const decodeResponse = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new ApiError(body.error ?? 'No se pudo completar la solicitud.', response.status);
  }
  return body as T;
};

const renovarTokens = async (tokens: Tokens): Promise<Tokens> => {
  const response = await fetch(`${API_BASE}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken })
  });
  const nuevos = await decodeResponse<Tokens>(response);
  saveTokens(nuevos);
  return nuevos;
};

const renovarTokensUnaVez = (tokens: Tokens): Promise<Tokens> => {
  if (!refreshInFlight) {
    refreshInFlight = renovarTokens(tokens).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
};

export const api = async <T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> => {
  const tokens = readTokens();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (tokens) headers.set('Authorization', `Bearer ${tokens.token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (
    retry &&
    tokens &&
    response.status === 403
  ) {
    const invalidToken = await response.clone().text();
    if (invalidToken.includes('Token inválido o expirado')) {
      try {
        await renovarTokensUnaVez(tokens);
        return api<T>(path, options, false);
      } catch {
        clearTokens();
        throw new ApiError('Tu sesión expiró. Iniciá sesión nuevamente.', 401);
      }
    }
  }

  return decodeResponse<T>(response);
};

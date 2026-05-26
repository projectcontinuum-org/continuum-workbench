import { CREDENTIALS_MANAGER_BASE } from './ApiConfig';

const API_BASE = `${CREDENTIALS_MANAGER_BASE}/api/v1/credentials`;

export interface CredentialResponse {
  userId: string;
  name: string;
  type: string;
  typeVersion: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export class CredentialsServiceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'CredentialsServiceError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    let message = errorText || `HTTP ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error) message = errorJson.error;
    } catch {
      // use raw text
    }
    throw new CredentialsServiceError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export class CredentialsService {
  /**
   * List all credentials for the current user
   */
  async list(): Promise<CredentialResponse[]> {
    const response = await fetch(API_BASE, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse<CredentialResponse[]>(response);
  }

  /**
   * List credentials filtered by type
   * @param type The credential type to filter by (e.g., 'BASIC', 'TOKEN')
   */
  async listByType(type: string): Promise<CredentialResponse[]> {
    const response = await fetch(`${API_BASE}/type/${encodeURIComponent(type)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse<CredentialResponse[]>(response);
  }

  /**
   * List credentials filtered by type and version
   * @param type The credential type to filter by (e.g., 'BASIC', 'TOKEN')
   * @param version The credential type version
   */
  async listByTypeAndVersion(type: string, version: string): Promise<CredentialResponse[]> {
    const response = await fetch(`${API_BASE}/type/${encodeURIComponent(type)}/${encodeURIComponent(version)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse<CredentialResponse[]>(response);
  }

  /**
   * Get a credential by name
   * @param name The credential name
   */
  async getByName(name: string): Promise<CredentialResponse> {
    const response = await fetch(`${API_BASE}/${encodeURIComponent(name)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse<CredentialResponse>(response);
  }
}

// Singleton instance
export const credentialsService = new CredentialsService();



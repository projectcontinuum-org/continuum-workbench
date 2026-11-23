import type { Credential } from '../../generated/credentials-server';
import { HttpReply } from '../../common/HttpReply';
import { requirePathSegment } from "../../common/SafeEncoding";
import { credentialsApi, reply } from './ApiClients';

/**
 * A credential as the workbench shows it. The server also returns the decrypted secret values (`data`); they are
 * dropped here so a secret never reaches React state, a log line or a re-render.
 */
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

// Caps how much of a non-JSON error response body (e.g. an HTML error page
// from a misconfigured proxy/base URL) can end up as the error message a
// renderer displays. Without this, CredentialRenderer's FormHelperText would
// render the full body verbatim, inflating that array item's layout height
// by however many wrapped lines the raw text takes.
const MAX_ERROR_MESSAGE_LENGTH = 300;

async function errorMessage(response: HttpReply): Promise<string> {
  const errorText = await response.text();
  let message = errorText || `HTTP ${response.status}`;
  try {
    const errorJson = JSON.parse(errorText);
    // Problem details carry the message in `detail`; `error` is the deprecated property of the former bodies.
    const fromBody = errorJson.detail || errorJson.error;
    if (typeof fromBody === 'string' && fromBody !== '') message = fromBody;
  } catch {
    // Not JSON. If it looks like an HTML page (e.g. a dev-server 404
    // fallback from a misconfigured base URL), it's not useful to a user
    // and can be arbitrarily long - fall back to a generic message.
    if (errorText.trimStart().startsWith('<')) {
      message = `HTTP ${response.status}`;
    }
  }
  return message.length > MAX_ERROR_MESSAGE_LENGTH ? `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH)}…` : message;
}

function toCredentialResponse(credential: Credential): CredentialResponse {
  return {
    userId: credential.userId,
    name: credential.name,
    type: credential.type,
    typeVersion: credential.typeVersion,
    description: credential.description ?? null,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt,
  };
}

async function credentialsOf(call: Promise<{ status: number; statusText: string; data: Credential[] }>): Promise<CredentialResponse[]> {
  const response = await reply(call);
  if (!response.ok) {
    throw new CredentialsServiceError(response.status, await errorMessage(response));
  }
  return response.data.map(toCredentialResponse);
}

export class CredentialsService {
  /**
   * List all credentials for the current user
   */
  async list(): Promise<CredentialResponse[]> {
    return credentialsOf(credentialsApi.listCredentials());
  }

  /**
   * List credentials filtered by type
   * @param type The credential type to filter by (e.g., 'BASIC', 'TOKEN')
   */
  async listByType(type: string): Promise<CredentialResponse[]> {
    return credentialsOf(credentialsApi.listCredentialsByType({ type: requirePathSegment(type) }));
  }

  /**
   * List credentials filtered by type and version
   * @param type The credential type to filter by (e.g., 'BASIC', 'TOKEN')
   * @param version The credential type version
   */
  async listByTypeAndVersion(type: string, version: string): Promise<CredentialResponse[]> {
    return credentialsOf(credentialsApi.listCredentialsByTypeVersion({ type: requirePathSegment(type), version: requirePathSegment(version) }));
  }

  /**
   * Get a credential by name
   * @param name The credential name
   */
  async getByName(name: string): Promise<CredentialResponse> {
    const response = await reply(credentialsApi.getCredential({ name: requirePathSegment(name) }));
    if (!response.ok) {
      throw new CredentialsServiceError(response.status, await errorMessage(response));
    }
    return toCredentialResponse(response.data);
  }
}

// Singleton instance
export const credentialsService = new CredentialsService();

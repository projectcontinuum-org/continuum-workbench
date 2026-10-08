// Detects whether the workbench is served behind the cloud-gateway reverse proxy
// and provides the correct API base URL prefix.
//
// Behind gateway (URL contains /workbench/{name}/open/):
//   API calls go through the gateway at /api-server/api/v1/...
//
// Direct access (development):
//   API calls go directly to /api/v1/... (same origin or dev proxy)

const isBehindGateway = /^\/workbench\/[^/]+\/open(\/|$)/.test(window.location.pathname) || window.location.pathname == "/";

export const API_SERVER_BASE = isBehindGateway ? '/api-server' : 'http://localhost:8080/api-server';
export const CREDENTIALS_MANAGER_BASE = isBehindGateway ? '/credentials-manager': 'http://localhost:8080/credentials-manager';

const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

// Behind gateway: same host, no port (ingress/gateway routes by path).
// Direct access (development): Mosquitto's WS listener on its docker-compose port.
export const MQTT_BASE = isBehindGateway ? `${wsProtocol}://${window.location.host}/mqtt` : `${wsProtocol}://localhost:31884/mqtt`;
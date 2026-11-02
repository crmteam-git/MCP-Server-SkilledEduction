import { config } from '../config.js';

export class HubSpotError extends Error {
    constructor(message, { status, category, correlationId, details } = {}) {
        super(message);
        this.name = 'HubSpotError';
        this.status = status;
        this.category = category;
        this.correlationId = correlationId;
        this.details = details;
    }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function buildUrl(path, query) {
    const url = new URL(config.baseUrl + path);
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value === undefined || value === null || value === '') continue;
        if (Array.isArray(value)) {
            if (value.length) url.searchParams.set(key, value.join(','));
        } else {
            url.searchParams.set(key, String(value));
        }
    }
    return url;
}

function retryDelayMs(response, attempt) {
    const retryAfter = Number(response?.headers.get('retry-after'));
    if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
    // Exponential backoff with jitter: ~0.5s, 1s, 2s, ...
    return 500 * 2 ** attempt + Math.floor(Math.random() * 250);
}

/**
 * Calls the HubSpot REST API. Retries on 429 and 5xx, and turns HubSpot's
 * error payloads into a HubSpotError with a readable message.
 */
export async function hubspotRequest(method, path, { query, body } = {}) {
    const url = buildUrl(path, query);

    for (let attempt = 0; ; attempt++) {
        let response;
        try {
            response = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${config.accessToken}`,
                    Accept: 'application/json',
                    ...(body !== undefined && { 'Content-Type': 'application/json' })
                },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: AbortSignal.timeout(config.requestTimeoutMs)
            });
        } catch (error) {
            if (attempt < config.maxRetries) {
                await sleep(retryDelayMs(undefined, attempt));
                continue;
            }
            throw new HubSpotError(`Network error calling HubSpot ${method} ${path}: ${error.message}`);
        }

        if ((response.status === 429 || response.status >= 500) && attempt < config.maxRetries) {
            await sleep(retryDelayMs(response, attempt));
            continue;
        }

        if (response.status === 204) return null;

        const text = await response.text();
        let data = null;
        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                data = { raw: text };
            }
        }

        if (!response.ok) {
            const hint =
                response.status === 401
                    ? ' Check that HUBSPOT_ACCESS_TOKEN is a valid private app token.'
                    : response.status === 403
                      ? ' The private app is probably missing a required scope.'
                      : '';
            throw new HubSpotError(
                `HubSpot ${method} ${path} failed (${response.status}): ${data?.message ?? response.statusText}.${hint}`,
                {
                    status: response.status,
                    category: data?.category,
                    correlationId: data?.correlationId,
                    details: data?.errors
                }
            );
        }

        return data;
    }
}

export const hubspot = {
    get: (path, query) => hubspotRequest('GET', path, { query }),
    post: (path, body, query) => hubspotRequest('POST', path, { body, query }),
    patch: (path, body) => hubspotRequest('PATCH', path, { body }),
    put: (path, body) => hubspotRequest('PUT', path, { body }),
    delete: path => hubspotRequest('DELETE', path)
};

export const seg = value => encodeURIComponent(String(value));

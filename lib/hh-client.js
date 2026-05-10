const REMOTE_BASE_URL = 'https://hh.hana.hs.kr';

function splitSetCookieHeader(headerValue) {
  if (!headerValue) return [];

  const parts = [];
  let start = 0;
  let insideExpires = false;

  for (let index = 0; index < headerValue.length; index += 1) {
    const char = headerValue[index];
    const nextChar = headerValue[index + 1];

    if (char === ',' && !insideExpires) {
      parts.push(headerValue.slice(start, index).trim());
      start = index + 1;
      continue;
    }

    if (char === 'e' && headerValue.slice(index, index + 8).toLowerCase() === 'expires=') {
      insideExpires = true;
    }

    if (insideExpires && char === ';') {
      insideExpires = false;
    }

    if (nextChar === undefined) {
      parts.push(headerValue.slice(start).trim());
    }
  }

  return parts.filter(Boolean);
}

export function getSetCookieLines(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie().filter(Boolean);
  }

  const singleHeader = headers.get('set-cookie');
  return splitSetCookieHeader(singleHeader);
}

export function cookiePairsFromSetCookieLines(setCookieLines = []) {
  return setCookieLines
    .map((line) => line.split(';')[0].trim())
    .filter(Boolean);
}

export function mergeCookieHeader(existingCookieHeader = '', setCookieLines = []) {
  const cookies = new Map();

  String(existingCookieHeader || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex > 0) {
        cookies.set(pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1));
      }
    });

  cookiePairsFromSetCookieLines(setCookieLines).forEach((pair) => {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex > 0) {
      cookies.set(pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1));
    }
  });

  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

export function extractCookieValue(cookieHeader = '', cookieName) {
  return String(cookieHeader || '')
    .split(';')
    .map((item) => item.trim())
    .find((pair) => pair.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1) || '';
}

export function buildRemoteHeaders({ cookieHeader, referer, origin, isAjax = true, contentType, authorization } = {}) {
  const headers = {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    Referer: referer || `${REMOTE_BASE_URL}/main/login/login.do`,
    Origin: origin || REMOTE_BASE_URL,
    'X-Requested-With': isAjax ? 'XMLHttpRequest' : 'fetch',
    'Cache-Control': 'no-cache'
  };

  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  if (authorization) {
    headers.Authorization = authorization;
  }

  return headers;
}

export async function fetchRemote(pathname, options = {}) {
  const response = await fetch(`${REMOTE_BASE_URL}${pathname}`, {
    ...options,
    cache: 'no-store'
  });

  return response;
}

export async function fetchRemoteJson(pathname, options = {}) {
  const response = await fetchRemote(pathname, options);
  const text = await response.text();

  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  return { response, json };
}

export function formBody(data) {
  return new URLSearchParams(data).toString();
}

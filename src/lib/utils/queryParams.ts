export const FILTER_KEYS = [
  'hasErrors_EQ',
  'observedAt_GTEQ',
  'observedAt_LTEQ',
  'operationName_EQ',
  'operationName_PRE',
  'client_EQ',
  'client_PRE',
  'errorMessage_EQ',
  'errorMessage_LIKE',
  'errorMessage_FUZZY',
  'traceId_EQ',
  'errorPath_EQ',
  'sourceAddr_EQ',
  'organizationId_EQ',
  'roles_IN',
  'tag_EQ',
  'operationName_IN',
  'operationName_OUT',
  'serverProcessTime_GTEQ',
  'serverProcessTime_LTEQ',
  'creditCost_GTEQ',
  'creditCost_LTEQ',
  'queryHash_EQ',
  'reason_EQ',
  'reason_IN',
  'status_EQ',
  'traceId_EQ',
  'traceId_IN',
  'userId_EQ',
  'fieldPath_EQ',
  'field_EQ',
  'category_EQ',
  'type_EQ',
  'userName_EQ',
  'serviceName_EQ',
  'serviceId_EQ',
  'version',
  'role',
  'operation',
  'status',
  'subgraph',
  'subgraphs',
  'tag',
  'userEmail',
  'userID',
  'tokenId_EQ'
];

export const updateQueryParams = (update: Record<string, any>, historyStrategy: 'push' | 'replace' = 'push') => {
  const params = new URLSearchParams(window.location.search);

  for (const name in update) {
    if (update[name] === undefined || update[name] === null) {
      params.delete(name);
    } else {
      params.set(name, update[name]);
    }
  }

  const url = `${window.location.pathname}?${params.toString()}`;

  if (url !== window.location.pathname + window.location.search) {
    if (historyStrategy === 'replace') {
      window.history.replaceState({}, '', url);
    } else {
      window.history.pushState({}, '', url);
    }
  }
};

export const updateQueryParamByName = (name: string, value: any, historyStrategy: 'push' | 'replace' = 'push') => {
  const params = new URLSearchParams(window.location.search);

  params.set(name, value);

  const url = `${window.location.pathname}?${params.toString()}`;

  if (url !== window.location.pathname + window.location.search) {
    if (historyStrategy === 'replace') {
      window.history.replaceState({}, '', url);
    } else {
      window.history.pushState({}, '', url);
    }
  }
};

export const deleteQueryParamByName = (name: string, historyStrategy: 'push' | 'replace' = 'push') => {
  const params = new URLSearchParams(window.location.search);

  if (params.has(name)) {
    params.delete(name);

    const url = `${window.location.pathname}?${params.toString()}`;

    if (url !== window.location.pathname + window.location.search) {
      if (historyStrategy === 'replace') {
        window.history.replaceState({}, '', url);
      } else {
        window.history.pushState({}, '', url);
      }
    }
  }
};

export const getQueryParamByName = (name: string, url = window.location.href) => {
  const params = new URL(url).searchParams;

  return params.get(name);
};

export const getQueryParamsObject = () => {
  const result: Record<string, any> = {};

  const params = new URLSearchParams(window.location.search);

  params.forEach((value, name) => {
    result[name] = value;
  });

  delete result.service;

  return result;
};

export const getQueryParamsFilter = (search = window.location.search) => {
  const result: Record<string, any> = {};

  const params = new URLSearchParams(search);

  params.forEach((value, name) => {
    if (FILTER_KEYS.includes(name)) {
      if (name.endsWith('_IN') || name.endsWith('_OUT')) {
        const values = value.split(',').filter(Boolean);

        if (values.length > 0) {
          result[name] = values;
        }
      } else {
        result[name] = value;
      }
    }
  });

  return result;
};

export const replaceQueryParamsFilter = (filter: Record<string, any>, historyStrategy: 'push' | 'replace' = 'push') => {
  const params = new URLSearchParams(window.location.search);
  const currentFilterParams = getQueryParamsFilter();

  for (const name in currentFilterParams) {
    params.delete(name);
  }

  for (const name in filter) {
    if (filter[name] === undefined || filter[name] === null) {
      params.delete(name);
    } else {
      if (Array.isArray(filter[name])) {
        params.set(name, filter[name].join(','));
      } else {
        params.set(name, filter[name]);
      }
    }
  }

  const url = `${window.location.pathname}?${params.toString()}`;

  if (url !== window.location.pathname + window.location.search) {
    if (historyStrategy === 'replace') {
      window.history.replaceState({}, '', url);
    } else {
      window.history.pushState({}, '', url);
    }
  }
};

export const clearQueryParams = (historyStrategy: 'push' | 'replace' = 'push') => {
  if (historyStrategy === 'replace') {
    window.history.replaceState({}, '', window.location.pathname);
  } else {
    window.history.pushState({}, '', window.location.pathname);
  }
};

const callbacks: ((params: Record<string, any>) => void)[] = [];

window.addEventListener('popstate', () => {
  const params = getQueryParamsObject();

  callbacks.forEach((callback) => callback(params));
});

const pushState = window.history.pushState;

window.history.pushState = function (data: any, unused: string, url: string | URL | null | undefined) {
  if (!url) {
    return pushState.apply(window.history, [data, unused, url]);
  }

  const currentUrl = new URL(window.location.href);
  const newUrl = new URL(window.location.origin + url);

  const result = pushState.apply(window.history, [data, unused, url]);

  if (currentUrl.search !== newUrl.search) {
    const params = getQueryParamsObject();

    callbacks.forEach((callback) => callback(params));
  }

  return result;
};

const replaceState = window.history.replaceState;

window.history.replaceState = function (data: any, unused: string, url: string | URL | null | undefined) {
  if (!url) {
    return replaceState.apply(window.history, [data, unused, url]);
  }
  
  const currentUrl = new URL(window.location.href);
  const newUrl = new URL(window.location.origin + url);

  const result = replaceState.apply(window.history, [data, unused, url]);

  if (currentUrl.search !== newUrl.search) {
    const params = getQueryParamsObject();

    callbacks.forEach((callback) => callback(params));
  }

  return result;
};

export const addQueryParamsListener = (callback: (typeof callbacks)[0]) => {
  if (callbacks.includes(callback)) {
    return;
  }

  callbacks.push(callback);

  return callback;
};

export const removeQueryParamsListener = (callback?: (typeof callbacks)[0]) => {
  if (!callback) {
    return;
  }

  const index = callbacks.indexOf(callback);

  if (index === -1) {
    return;
  }

  callbacks.splice(index, 1);
};

export const getUpdatedUrl = (params: Record<string, any>, href?: string) => {
  const url = new URL(href ?? window.location.href);

  for (const key in params) {
    if (params[key] === undefined || params[key] === null) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, params[key]);
    }
  }

  return url.pathname + url.search;
};

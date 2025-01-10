import classNames from "classnames";
import {
  DefinitionNode,
  DocumentNode,
  ExecutionResult,
  getIntrospectionQuery,
  getOperationAST,
  IntrospectionQuery,
  parse,
  print,
} from "graphql";
import { createClient, Sink } from "graphql-ws";
import { debounce, get, throttle } from "lodash";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getOperationName } from "@apollo/client/utilities";

import AutoComplete from "../components/AutoComplete/AutoComplete";
import Button from "../components/Button/Button";
import Checkbox from "../components/Checkbox/Checkbox";
import CodeEditor from "../components/code-editor";
import { ICodeEditorRef } from "../components/code-editor/code-editor.types";
import Form from "../components/Form/Form";
import { FormRef } from "../components/Form/Form.types";
import Icon, {
  AddCircle,
  ArrowLeft,
  ArrowRight,
  Close,
  IconCollectionsFilled,
  IconInfo,
  IconLocked,
  IconUnlocked,
} from "../components/Icon/Icon";
import { MessageType } from "../components/MessagesWrapper/MessagesWrapper.types";
import { message } from "../components/MessagesWrapper/MessagesWrapper.utils";
import Modal from "../components/Modal/Modal";
// import {
//   ISchemaPropsItemProperty,
//   ISchemaPropsItemPropertyTypeDef,
//   ISchemaPropsItemType,
//   ISchemaPropsModel,
// } from "../components/Schema/Schema.types";
import Select, { Option as SelectOption } from "../components/Select/Select";
import TextInput from "../components/TextInput/TextInput";
import Tooltip, { TooltipPosition } from "../components/Tooltip/Tooltip";
import { useWindowSize } from "../utils/helpers";
import localPreferences, {
  ILocalPreferencesData,
} from "../utils/localPreferences";
import {
  deleteQueryParamByName,
  getQueryParamByName,
} from "../utils/queryParams";
import { Maybe } from "../utils/types";
import ExplorerRequest, { RequestRef } from "./components/Request/Request";
import ExplorerResponse from "./components/Response/Response";
import ExplorerSidebar from "./components/Sidebar/Sidebar";
import styles from "./Explorer.module.css";
import { HashRouter } from "react-router-dom";
import Drawer from "../components/Drawer/Drawer";
import Schema from "../components/Schema/Schema";
import {
  ISchemaPropsItemProperty,
  ISchemaPropsItemPropertyTypeDef,
  ISchemaPropsItemType,
  ISchemaPropsModel,
} from "../components/Schema/Schema.types";

function parseTypeDetails(type: any): ISchemaPropsItemPropertyTypeDef {
  const typeDef: ISchemaPropsItemPropertyTypeDef = {
    Index: type.index || 0,
    TypeName: type.name || "",
    Required: type.kind === "NON_NULL",
  };

  if (type.ofType) {
    typeDef.List = parseTypeDetails(type.ofType);
  }

  return typeDef;
}

// Function to map GraphQL kind to ISchemaPropsItemType
function mapKindToItemType(kind: string): ISchemaPropsItemType {
  switch (kind) {
    case "OBJECT":
      return ISchemaPropsItemType.Types;
    case "INPUT_OBJECT":
      return ISchemaPropsItemType.Inputs;
    case "INTERFACE":
      return ISchemaPropsItemType.Interfaces;
    case "ENUM":
      return ISchemaPropsItemType.Enums;
    case "UNION":
      return ISchemaPropsItemType.Unions;
    case "SCALAR":
      return ISchemaPropsItemType.Scalars;
    case "SCHEMA":
      return ISchemaPropsItemType.Schema;
    default:
      return ISchemaPropsItemType.Types; // default to Types if kind is not matched
  }
}

// Function to format introspection query response
export function formatIntrospectionResponse(
  introspectionData: any
): ISchemaPropsModel {
  const schema: ISchemaPropsModel = introspectionData.__schema.types.map(
    (type: any) => {
      let properties: ISchemaPropsItemProperty[] = [];

      if (type.fields || type.inputFields) {
        properties = (type.fields || type.inputFields).map(
          (field: any, index: number) => ({
            name: field.name,
            count: field.count || 0,
            calls: field.calls || 0,
            tags: field.tags || [],
            type: field.type.name,
            description: field.description || "",
            typeDetails: {
              Name: field.name,
              DefaultValue: field.defaultValue || null,
              Index: index,
              Type: parseTypeDetails(field.type),
            },
            args: field.args?.reduce(
              (acc: Record<string, any>, arg: any, argIndex: number) => {
                acc[arg.name] = {
                  Name: arg.name,
                  DefaultValue: arg.defaultValue || null,
                  Index: argIndex,
                  Type: parseTypeDetails(arg.type),
                };
                return acc;
              },
              {}
            ),
          })
        );
      }

      if (type.enumValues) {
        properties = type.enumValues.map((enumValue: any, index: number) => ({
          name: enumValue.name,
          count: enumValue.count || 0,
          calls: enumValue.calls || 0,
          tags: enumValue.tags || [],
          type: type.name,
          description: enumValue.description || "",
          typeDetails: {
            Name: enumValue.name,
            Index: index,
            Type: parseTypeDetails(type),
          },
        }));
      }

      return {
        name: type.name,
        type: mapKindToItemType(type.kind),
        tags: type.tags || [],
        description: type.description || "",
        properties,
        implements: type.interfaces?.map((iface: any) => iface.name) || [],
      };
    }
  );

  return schema;
}

export interface ExplorerFetcherOptions {
  query?: string;
  operationName?: string;
  variables?: Record<string, any>;
  extensions?: Record<string, any>;
  headers?: Record<string, string>;
}

export interface ExplorerCorsFetcherOptions {
  url?: string;
  query?: string;
  operationName?: string;
  variables?: Record<string, any>;
  extensions?: Record<string, any>;
  headers?: Record<string, string>;
}

export const guuid = () => {
  return Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .substring(1);
};

export interface ExplorerTabInfoResponse {
  data: any;
  headers?: Maybe<any>;
  status?: Maybe<number>;
  sent?: Maybe<number>;
  time: number;
  size?: Maybe<number>;
  traceId?: Maybe<string>;
}

export interface ExplorerTabInfo {
  query?: Maybe<string>;
  variables: Maybe<string>;
  extensions?: Maybe<string>;
  response?: Maybe<ExplorerTabInfoResponse>;
}

export interface ExplorerTabHistoryItem extends ExplorerTabInfo {
  operationName?: Maybe<string | null>;
  serviceKey?: Maybe<{
    name: string;
    label?: Maybe<string>;
  }>;
  createdAt: string;
}

export interface ExplorerTab extends ExplorerTabInfo {
  id: string;
  doc?: Maybe<ReturnType<typeof parse>>;
  docLastQuery?: Maybe<string>;
  operationId?: Maybe<string>;
  collectionId?: Maybe<string>;
  collectionName?: Maybe<string>;
  isHistoryTab?: Maybe<boolean>;
}

export interface ExplorerCollectionOperation
  extends Pick<ExplorerTabInfo, "query" | "variables"> {
  name: string;
}

export interface ExplorerCollection {
  id: string;
  name: string;
  operations: ExplorerCollectionOperation[];
}

export type ExplorerInputField =
  | string
  | {
      name: string;
      label?: string;
      secured?: boolean;
    };

const getDefaultValue = (
  preferencesKey: keyof ILocalPreferencesData["explorer"],
  defaultValue: any
) => {
  if (import.meta.env.VITE_EXPLORER) {
    return localPreferences.get("explorer")[preferencesKey] ?? defaultValue;
  }

  return defaultValue;
};

interface ExplorerProps {
  defaultState?: ILocalPreferencesData["explorer"];
  serviceKey?: Maybe<{
    name: string;
    label?: Maybe<string>;
  }>;
  request?: (
    options: ExplorerFetcherOptions & {
      proxyEnabled?: boolean;
      fetcherUrl?: string;
    }
  ) => Promise<Response>;
  access?: "admin" | "user";
  onStateChange?: (state: ILocalPreferencesData["explorer"]) => void;
  theme?: "light" | "dark";
}

export default function Explorer(props: ExplorerProps) {
  useEffect(() => {
    document.title = `Explorer | Inigo`;
  }, []);

  const inputModalRef = useRef<any>(null);
  const inputFormRef = useRef<FormRef>(null);
  const onInputModalSubmitRef = useRef<(() => void) | null>(null);
  const onInputModalHideRef = useRef<(() => void) | null>(null);
  const [inputModalFields, setInputModalFields] = useState<
    ExplorerInputField[]
  >([]);
  const [inputModalData, setInputModalData] = useState<Record<string, any>>({});

  const requestRef = useRef<RequestRef>(null);

  const showInputModal = useCallback(
    (fields: ExplorerInputField[]) => {
      inputModalRef.current?.open();

      return new Promise((resolve) => {
        setInputModalData({});
        setInputModalFields(fields);
        onInputModalSubmitRef.current = () => {
          resolve(inputFormRef.current?.getValue() || {});
          inputModalRef.current?.close();
          inputFormRef.current?.clear();
        };

        onInputModalHideRef.current = () => {
          resolve({});
          inputModalRef.current?.close();
          inputFormRef.current?.clear();
        };
      });
    },
    [inputModalRef]
  );

  const onInputModalHide = useCallback(() => {
    if (onInputModalHideRef.current) {
      onInputModalHideRef.current();
    }
  }, [onInputModalHideRef]);

  const submitInputModal = useCallback(() => {
    if (onInputModalSubmitRef.current) {
      onInputModalSubmitRef.current();
    }
  }, [onInputModalSubmitRef]);

  const [collections, setCollections] = useState<ExplorerCollection[]>(
    getDefaultValue("collections", [])
  );
  const [sharedCollections, setSharedCollections] = useState<
    ExplorerCollection[]
  >([]);

  const preflightModalRef = useRef<any>(null);

  const [preflightFailed, setPreflightFailed] = useState<boolean>(
    getDefaultValue("preflightEnabled", false)
  );
  const [preflightOutput, setPreflightOutput] = useState<string[]>([]);

  const [preflightScript, setPreflightScript] = useState<string>(
    getDefaultValue("preflightScript", "")
  );
  const [preflightEnabled, setPreflightEnabled] = useState<boolean>(
    localPreferences.get("explorer").preflightEnabled || true
  );

  const envVariablesModalRef = useRef<any>(null);
  const envVariablesEditorRef = useRef<ICodeEditorRef>(null);
  const [envVariables, setEnvVariables] = useState<string>(
    localPreferences.get("explorer").envVariables || ""
  );
  const throttledSetEnvVariables = useMemo(
    () => throttle(setEnvVariables, 500),
    []
  );

  const [proxyEnabled, setProxyEnabled] = useState<boolean>(
    localPreferences.get("explorer").proxyEnabled || false
  );
  const [historyEnabled, setHistoryEnabled] = useState<boolean>(
    localPreferences.get("explorer").historyEnabled || true
  );

  const [url, setUrl] = useState<string>(
    getDefaultValue("url", props.defaultState?.url || "")
  );

  const throttledSetUrl = useMemo(
    () =>
      debounce((value: string) => {
        message({
          type: MessageType.Success,
          text: "GraphQL endpoint updated",
        });

        return setUrl(value);
      }, 1000),
    []
  );

  useEffect(() => {
    if (url.includes("localhost") && proxyEnabled) {
      setProxyEnabled(false);

      message({
        type: MessageType.Success,
        text: "Proxy disabled for localhost",
      });
    }
  }, [url, proxyEnabled]);

  const [schema, setSchema] = useState<IntrospectionQuery>();

  const [history, setHistory] = useState<ExplorerTabHistoryItem[]>(
    localPreferences.get("explorer").history ?? []
  );

  const deleteHistory = useCallback(() => {
    const cachedHistory = [...history];
    setHistory([]);
    setTabs((prev) => prev.filter((tab) => !tab.isHistoryTab));

    message({
      type: MessageType.Success,
      text: "History cleared",
      action: {
        label: "Undo",
        onClick: () => {
          setHistory(cachedHistory);
        },
      },
    });
  }, [history]);

  const deleteHistoryItem = useCallback(
    (itemToDelete: ExplorerTabHistoryItem) => {
      setHistory((prev) => prev.filter((item) => item !== itemToDelete));

      message({
        type: MessageType.Success,
        text: `${
          itemToDelete.operationName
            ? `"${itemToDelete.operationName}"`
            : "History item"
        } has been deleted`,
        action: {
          label: "Undo",
          onClick: () => {
            setHistory((prev) => [...prev, itemToDelete]);
          },
        },
      });
    },
    [history]
  );

  const [headers, setHeaders] = useState<string>(
    localPreferences.get("explorer").headers ?? ""
  );

  const [tabs, setTabs] = useState<ExplorerTab[]>(
    getDefaultValue("tabs", [
      {
        id: guuid(),
        query: "",
        variables: "{}",
      },
    ])
  );

  const [selectedOperationName, setSelectedOperationName] = useState<
    string | undefined
  >();
  const [queryCursorPosition, setQueryCursorPosition] = useState<{
    lineNumber: number;
    column: number;
  }>({
    lineNumber: 0,
    column: 0,
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    setTabs((prev) => {
      let shouldUpdate = false;

      const newTabs = prev.map((tab) => {
        if (tab.docLastQuery !== tab.query) {
          if (tab.query) {
            try {
              tab.doc = parse(tab.query);
            } catch (e) {}
          } else {
            tab.doc = undefined;
          }

          tab.docLastQuery = tab.query;
          shouldUpdate = true;
        }

        return tab;
      });

      if (shouldUpdate) {
        return newTabs;
      }

      return prev;
    });
  }, [tabs]);

  const [activeTabId, _setActiveTabId] = useState<string>(
    getDefaultValue("activeTabId", tabs?.[0]?.id)
  );
  const activeTabIdRef = useRef<string>();

  const [isSubscriptionActive, setIsSubscriptionActive] =
    useState<boolean>(false);
  const [terminateSubscription, setTerminateSubscription] = useState<
    (() => void) | null
  >(null);

  const setActiveTabId = useCallback(
    (id: string) => {
      _setActiveTabId(id);

      if (isSubscriptionActive) {
        if (terminateSubscription) {
          terminateSubscription();
        }

        setTerminateSubscription(null);
        setIsSubscriptionActive(false);
      }
    },
    [terminateSubscription, isSubscriptionActive]
  );

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    if (tabs.some((tab) => tab.id === activeTabId)) {
      return;
    }

    if (tabs.length === 0) {
      return;
    }

    setActiveTabId(tabs[0].id);
  }, [tabs, activeTabId]);

  const tabsRef = useRef<ExplorerTab[]>(tabs);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  const getTabById = useCallback(
    (id: string, tabsToSearch: ExplorerTab[] = tabs) => {
      return tabsToSearch.find((tab) => tab.id === id);
    },
    [tabs]
  );

  const updateActiveTab = useCallback(
    (update: React.SetStateAction<ExplorerTab>) => {
      setTabs((prev) =>
        prev.map((prevItem) => {
          let result = prevItem;

          if (prevItem.id === activeTabIdRef.current) {
            result = typeof update === "function" ? update(prevItem) : update;
          }

          // updateQueryParams({ query: result.query }, 'replace');

          return result;
        })
      );
    },
    []
  );

  const deleteTabById = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const result = prev.filter((prevTab) => prevTab.id !== id);

        if (result.length === 0) {
          return [
            {
              id: guuid(),
              query: "",
              variables: "{}",
              headers: "{}",
              history: [],
            },
          ];
        }

        return result;
      });
    },
    [tabs]
  );

  const activeTab = useMemo(
    () => getTabById(activeTabId) || tabs[0],
    [tabs, activeTabId, getTabById]
  );

  const windowSize = useWindowSize();
  const scrollInnerRef = useRef<HTMLDivElement>(null);
  const [scrollLeftPosition, setScrollLeftPosition] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const scrollRight = () => {
    const { current: scrollInnerEl } = scrollInnerRef;

    if (scrollInnerEl) {
      scrollInnerEl.scrollTo({
        left: scrollInnerEl.scrollLeft + 157,
        behavior: "smooth",
      });
    }
  };

  const scrollLeft = () => {
    const { current: scrollInnerEl } = scrollInnerRef;

    if (scrollInnerEl) {
      scrollInnerEl.scrollTo({
        left: scrollInnerEl.scrollLeft - 157,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    const { current: scrollInnerEl } = scrollInnerRef;

    if (scrollInnerEl) {
      setCanScrollLeft(scrollInnerEl.scrollLeft > 0);
      setCanScrollRight(
        scrollInnerEl.scrollLeft + scrollInnerEl.offsetWidth <
          scrollInnerEl.scrollWidth - 10
      );
    }
  }, [tabs, scrollLeftPosition, windowSize.width]);

  const [ready, setReady] = useState<boolean>(
    import.meta.env.VITE_EXPLORER ? true : false
  );

  const [urlWasTaken, setUrlWasTaken] = useState<boolean>(false);
  const [queryWasTaken, setQueryWasTaken] = useState<boolean>(false);
  const [variablesWasTaken, setVariablesWasTaken] = useState<boolean>(false);
  const [extensionsWasTaken, setExtensionsWasTaken] = useState<boolean>(false);
  const [headersWasTaken, setHeadersWasTaken] = useState<boolean>(false);
  const [proxyEnabledWasTaken, setProxyEnabledWasTaken] =
    useState<boolean>(false);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const queryQueryParam = getQueryParamByName("query");
    const variablesQueryParam = getQueryParamByName("variables");
    const extensionsQueryParam = getQueryParamByName("extensions");
    const headersQueryParam = getQueryParamByName("headers");

    if (
      !queryWasTaken &&
      !variablesWasTaken &&
      !extensionsWasTaken &&
      !headersWasTaken &&
      (queryQueryParam ||
        variablesQueryParam ||
        extensionsQueryParam ||
        headersQueryParam)
    ) {
      const update: Partial<ExplorerTab> = {};

      setQueryWasTaken(true);
      setVariablesWasTaken(true);
      setExtensionsWasTaken(true);
      setHeadersWasTaken(true);

      if (queryQueryParam) {
        update.query = queryQueryParam;

        deleteQueryParamByName("query", "replace");
      } else {
        update.query = "";
      }

      if (variablesQueryParam) {
        let variables = variablesQueryParam;

        if (!variables && update.query) {
          const parsedQuery = parse(update.query);

          const operation = getOperationAST(
            parsedQuery,
            getOperationName(parsedQuery as any)
          );

          if (operation?.variableDefinitions) {
            variables = JSON.stringify(
              {
                ...Object.fromEntries(
                  operation?.variableDefinitions?.map((variableDefinition) => {
                    return [variableDefinition.variable.name.value, null];
                  })
                ),
              },
              null,
              2
            );
          }
        }

        update.variables = variables || "{}";

        deleteQueryParamByName("variables", "replace");
      }

      if (extensionsQueryParam) {
        update.extensions = extensionsQueryParam;

        deleteQueryParamByName("extensions", "replace");
      } else {
        update.extensions = "{}";
      }

      if (headersQueryParam) {
        setHeaders(headersQueryParam);
        deleteQueryParamByName("headers", "replace");
      } else {
        setHeaders("{}");
      }

      if (Object.keys(update).length) {
        updateActiveTab((prev) => {
          return {
            ...prev,
            ...update,
          };
        });
      }
    }

    if (!proxyEnabledWasTaken) {
      setProxyEnabledWasTaken(true);

      const proxyQueryParam = getQueryParamByName("proxyEnabled") === "true";

      if (proxyQueryParam) {
        setProxyEnabled(true);
        deleteQueryParamByName("proxyEnabled", "replace");
      }
    }

    if (!urlWasTaken) {
      setUrlWasTaken(true);

      const urlQueryParam = getQueryParamByName("endpoint");

      if (urlQueryParam) {
        message({
          type: MessageType.Success,
          text: "GraphQL endpoint updated",
        });

        setUrl(urlQueryParam);
      } else {
        (async () => {
          if (!url) {
            const { url: newUrl } = (await showInputModal([
              { label: "GraphQL endpoint", name: "url" },
            ])) as {
              url: string;
            };

            if (!newUrl) {
              return;
            }

            message({
              type: MessageType.Success,
              text: "GraphQL endpoint updated",
            });

            setUrl(newUrl);
          }
        })();
      }

      deleteQueryParamByName("endpoint", "replace");
    }

    if (import.meta.env.VITE_EXPLORER) {
      localPreferences.set("explorer", {
        url,
        activeTabId,
        tabs,
        collections,
        preflightScript,
        history,
        headers,
        preflightEnabled,
        envVariables,
        proxyEnabled,
        historyEnabled,
      });
    } else {
      props.onStateChange?.({
        url,
        activeTabId,
        tabs,
        collections,
        preflightScript,
        history,
        headers,
        preflightEnabled,
        envVariables,
        proxyEnabled,
        historyEnabled,
      });

      localPreferences.set("explorer", {
        history,
        headers,
        preflightEnabled,
        envVariables,
        proxyEnabled,
        historyEnabled,
      });
    }
  }, [
    preflightScript,
    history,
    preflightEnabled,
    envVariables,
    url,
    tabs,
    activeTabId,
    collections,
    sharedCollections,
    headers,
    ready,
    proxyEnabled,
    historyEnabled,
  ]);

  useEffect(() => {
    if (props.defaultState !== undefined) {
      if (props.defaultState?.url) {
        setUrl(props.defaultState?.url);
      }

      if (props.defaultState?.tabs?.length) {
        setTabs(
          props.defaultState?.tabs.map((tab) => ({
            ...tab,
            collectionName: tab.operationId,
          })) as ExplorerTab[]
        );
        setActiveTabId(
          props.defaultState?.activeTabId || props.defaultState?.tabs?.[0].id
        );
      } else {
        const id = guuid();

        setTabs([
          {
            id,
            query: "",
            variables: "{}",
          },
        ]);

        setActiveTabId(id);
      }

      if (props.defaultState?.collections) {
        setCollections(props.defaultState?.collections as ExplorerCollection[]);
      }

      if (props.defaultState?.preflightScript) {
        setPreflightScript(props.defaultState?.preflightScript);
      }

      if (props.defaultState?.collections) {
        setSharedCollections(
          props.defaultState?.collections as ExplorerCollection[]
        );
      }

      setReady(true);
    }
  }, []);

  const createFetcher = useCallback(
    (fetcherUrl: string, proxyEnabled?: boolean) => {
      return async (options: ExplorerFetcherOptions) => {
        const body: any = {};

        if (options.query) {
          body.query = options.query;
        }

        if (options.variables) {
          body.variables = options.variables;
        }

        if (options.extensions) {
          body.extensions = options.extensions;
        }

        if (options.operationName) {
          body.operationName = options.operationName;
        }

        if (props.request) {
          return props.request({
            query: body.query,
            variables: body.variables,
            extensions: body.extensions,
            operationName: body.operationName,
            proxyEnabled,
            fetcherUrl,
          });
        }

        return fetch(fetcherUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
          },
          body: JSON.stringify(body),
        });
      };
    },
    [props.request]
  );

  const createWsFetcher = useCallback((fetcherUrl: string) => {
    return async (options: ExplorerFetcherOptions) => {
      const client = createClient({
        url: fetcherUrl.replace("http", "ws"),
        connectionParams: {
          ...options.headers,
        },
      });

      client.on("connected", () => {
        setIsSubscriptionActive(true);
      });

      client.on("error", (error) => {
        console.error(error);
        setIsSubscriptionActive(false);
      });

      client.on("closed", () => {
        setIsSubscriptionActive(false);
      });

      setTerminateSubscription(() => {
        return () => {
          client.dispose();
        };
      });

      return {
        client,
        iterate: () =>
          client.iterate({
            query: options.query!,
            variables: options.variables,
            operationName: options.operationName,
          }),
        subscribe: (
          sink: Sink<ExecutionResult<Record<string, unknown>, unknown>>
        ) => {
          return client.subscribe(
            {
              query: options.query!,
              variables: options.variables,
              operationName: options.operationName,
            },
            sink as any
          );
        },
      };
    };
  }, []);

  const fetcher = useMemo(() => {
    return createFetcher(url, proxyEnabled);
  }, [url, proxyEnabled]);

  const wsFetcher = useMemo(() => {
    return createWsFetcher(url);
  }, [url]);

  const [introspectionLoading, setIntrospectionLoading] =
    useState<boolean>(false);
  const queryIntrospectionTimeoutRef = useRef<number>();

  const queryIntrospection = useCallback(async () => {
    if (!fetcher) {
      return;
    }

    if (!url) {
      setSchema(undefined);
      return;
    }

    setIntrospectionLoading(true);

    window.clearTimeout(queryIntrospectionTimeoutRef.current);

    queryIntrospectionTimeoutRef.current = window.setTimeout(async () => {
      let envVariablesData: Record<string, string> = {};

      try {
        envVariablesData = JSON.parse(envVariables || "{}");
      } catch (e) {}

      let parsedHeaders: Record<string, string> = {};

      try {
        let headersString: string = headers || "{}";

        if (headersString && envVariablesData) {
          headersString = headersString.replace(/{{(.+?)}}/g, (match, p1) =>
            get(envVariablesData, p1, match)
          );
        }

        parsedHeaders = JSON.parse(headersString);
      } catch (e) {}

      try {
        const response = await fetcher({
          query: getIntrospectionQuery(),
          headers: parsedHeaders,
        });

        setSchema(
          ((await response.json()) as any).data as unknown as IntrospectionQuery
        );
      } catch (e) {
        setSchema(undefined);
        message({
          type: MessageType.Error,
          text: "Failed to query introspection, that could be caused by CORS policy.",
          action: {
            label: "Enable proxy",
            onClick: () => {
              setProxyEnabled(true);
            },
          },
        });
      }

      setIntrospectionLoading(false);
    }, 500);
  }, [preflightScript, envVariables, headers, url, fetcher]);

  useEffect(() => {
    queryIntrospection();
  }, [queryIntrospection, fetcher]);

  const query = useCallback(
    async (
      operationName?: string,
      fetcherOverride?: (options: ExplorerFetcherOptions) => Promise<Response>
    ) => {
      updateActiveTab((prev) => {
        return {
          ...prev,
          response: undefined,
        };
      });

      if (!url && !fetcherOverride) {
        const { url: newUrl } = (await showInputModal([
          { label: "Enter URL", name: "url" },
        ])) as { url: string };

        if (!newUrl) {
          return;
        }

        setUrl(newUrl);

        query(operationName, createFetcher(newUrl));

        return;
      }

      const fetcherToUse = fetcherOverride || fetcher;

      if (!fetcherToUse || !activeTab) {
        return;
      }

      setIsLoading(true);

      let envVariablesData: Record<string, string> = {};

      try {
        envVariablesData = JSON.parse(envVariables || "{}");
      } catch (e) {}

      setPreflightFailed(false);
      setPreflightOutput([]);

      if (preflightEnabled && preflightScript) {
        const _log = console.log;
        const _error = console.error;
        const _warn = console.warn;

        const output: string[] = [];

        console.log = (...args: any[]) => {
          try {
            output.push(args.map((arg) => `${arg}`).join(" "));
          } catch (e) {}

          _log(...args);
        };

        console.error = (...args: any[]) => {
          try {
            output.push(args.map((arg) => `${arg}`).join(" "));
          } catch (e) {}

          _error(...args);
        };

        console.warn = (...args: any[]) => {
          try {
            output.push(args.map((arg) => `${arg}`).join(" "));
          } catch (e) {}

          _warn(...args);
        };

        try {
          const AsyncFunction = Object.getPrototypeOf(
            async function () {}
          ).constructor;

          const preflightScriptFunction = new AsyncFunction(
            "inigo",
            preflightScript
          );

          const context = {
            environment: {
              set: (key: string, value: any) => {
                envVariablesData[key] = value;

                setEnvVariables(JSON.stringify(envVariablesData, null, 2));
                envVariablesEditorRef.current?.setValue(
                  JSON.stringify(envVariablesData, null, 2)
                );
              },
              get: (key: string) => {
                return envVariablesData[key];
              },
            },
            input: async (fields: string[]) => {
              return await showInputModal(fields);
            },
            fetcher: fetcherToUse,
          };

          await preflightScriptFunction(context);

          console.log = _log;
          console.error = _error;
          console.warn = _warn;

          setPreflightOutput(output);
        } catch (err: any) {
          console.error(err.message);

          message({
            type: MessageType.Error,
            text: "Preflight script failed, check preflight tab in resonse pane for more details.",
          });

          console.log = _log;
          console.error = _error;
          console.warn = _warn;

          setIsLoading(false);
          setPreflightOutput(output);

          updateActiveTab((prev) => {
            return {
              ...prev,
              response: {
                data: {
                  error: err.message,
                },
                sent: 0,
                time: 0,
              },
            };
          });
          return;
        }
      }

      let parsedHeaders: Record<string, string> = {};

      try {
        let headersString: string = headers || "{}";

        if (headersString && envVariablesData) {
          headersString = headersString.replace(/{{(.+?)}}/g, (match, p1) =>
            get(envVariablesData, p1, match)
          );
        }

        parsedHeaders = JSON.parse(headersString);
      } catch (e) {}

      let variables: Record<string, any> = {};

      try {
        let variablesString: string = activeTab.variables || "{}";

        if (variablesString && envVariablesData) {
          variablesString = variablesString.replace(/{{(.+?)}}/g, (match, p1) =>
            get(envVariablesData, p1, match)
          );
        }

        variables = JSON.parse(variablesString);
      } catch (e) {}

      let extensions: Record<string, any> = {};

      try {
        let extensionsString: string = activeTab.extensions || "{}";

        if (extensionsString && envVariablesData) {
          extensionsString = extensionsString.replace(
            /{{(.+?)}}/g,
            (match, p1) => get(envVariablesData, p1, match)
          );
        }

        extensions = JSON.parse(extensionsString);
      } catch (e) {}

      const sendDate = new Date().getTime();

      try {
        let printedQuery: string | undefined;

        if (
          !activeTab.query!.replace(/\s\s/g, " ") &&
          Object.keys(activeTab.extensions ?? {}).length
        ) {
          printedQuery = "";
        } else {
          let query:
            | (Omit<DocumentNode, "definitions"> & {
                definitions: DefinitionNode[];
              })
            | null = null;

          try {
            // remove comments
            const queryString = activeTab
              .query!.split("\n")
              .filter((line) => {
                return !line.trim().startsWith("#");
              })
              .join("\n");

            query = parse(queryString) as Omit<DocumentNode, "definitions"> & {
              definitions: DefinitionNode[];
            };
          } catch (e) {
            throw new Error("Query is not valid");
          }

          if (
            query &&
            operationName &&
            query.definitions.some(
              (definition) =>
                definition.kind === "OperationDefinition" &&
                (definition as any).name?.value === operationName
            )
          ) {
            query.definitions = query.definitions.filter((definition) => {
              if (definition.kind === "OperationDefinition") {
                if (operationName !== (definition as any).name?.value) {
                  return false;
                }
              }

              return true;
            });
          }

          if (query) {
            try {
              printedQuery = print(query);
            } catch {}
          }
        }

        if (printedQuery?.startsWith("subscription")) {
          const fetcher = await wsFetcher({
            query: printedQuery,
            variables,
            operationName,
            headers: parsedHeaders,
          });

          setIsLoading(false);

          fetcher.subscribe({
            next: (result) => {
              updateActiveTab((prev) => {
                return {
                  ...prev,
                  response: {
                    data: [
                      {
                        receivedAt: new Date().toISOString(),
                        data: result.data,
                      },
                      ...(prev.response && Array.isArray(prev.response?.data)
                        ? prev.response.data
                        : []),
                    ],
                    headers: {},
                    status: 200,
                    sent: sendDate,
                    time: new Date().getTime() - sendDate,
                    size: 0,
                  },
                };
              });
            },
            error: (error: any) => {
              updateActiveTab((prev) => {
                return {
                  ...prev,
                  response: {
                    data: [
                      {
                        receivedAt: new Date().toISOString(),
                        data: error,
                      },
                      ...(prev.response && Array.isArray(prev.response?.data)
                        ? prev.response.data
                        : []),
                    ],
                    headers: {},
                    status: 200,
                    sent: sendDate,
                    time: new Date().getTime() - sendDate,
                    size: 0,
                  },
                };
              });

              setIsSubscriptionActive(false);
            },
            complete: () => {
              setIsSubscriptionActive(false);
            },
          });

          // for await (const result of fetcher.iterate()) {
          //   updateActiveTab((prev) => {
          //     return {
          //       ...prev,
          //       response: {
          //         data: [
          //           {
          //             receivedAt: new Date().toISOString(),
          //             data: result.data,
          //           },
          //           ...(prev.response && Array.isArray(prev.response?.data) ? prev.response.data : []),
          //         ],
          //         headers: {},
          //         status: 200,
          //         sent: sendDate,
          //         time: new Date().getTime() - sendDate,
          //         size: 0,
          //       },
          //     };
          //   });
          // }

          return;
        }

        const response = await fetcherToUse({
          query: printedQuery,
          variables,
          extensions,
          operationName,
          headers: parsedHeaders,
        });

        const responseText = await response.text();
        const responseJson = JSON.parse(responseText);

        const responseInfo = {
          data: responseJson,
          headers: Object.fromEntries(response.headers.entries()),
          status: response.status,
          sent: sendDate,
          time: new Date().getTime() - sendDate,
          size: responseText.length,
          traceId: responseJson?.extensions?.inigo?.trace_id,
        };

        updateActiveTab((prev) => {
          return {
            ...prev,
            response: responseInfo,
          };
        });

        if (historyEnabled) {
          setHistory((prev) => [
            {
              query: activeTab.query,
              variables: activeTab.variables,
              extensions: activeTab.extensions,
              response: responseInfo,
              operationName: operationName,
              serviceKey: props.serviceKey,
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
      } catch (err: any) {
        updateActiveTab((prev) => {
          return {
            ...prev,
            response: {
              data: {
                error: err.message,
              },
              sent: sendDate,
              time: new Date().getTime() - sendDate,
            },
          };
        });
      }

      setIsLoading(false);
    },
    [
      props.serviceKey,
      showInputModal,
      activeTab,
      fetcher,
      preflightEnabled,
      preflightScript,
      envVariablesEditorRef,
      headers,
      historyEnabled,
    ]
  );

  useEffect(() => {
    setTabs((prev) => {
      let shouldUpdate = false;

      prev.forEach((tab, index) => {
        if (tab.collectionId) {
          const foundCollection =
            collections.find(
              (collection) => collection.id === tab.collectionId
            ) ||
            sharedCollections.find(
              (collection) => collection.id === tab.collectionId
            );

          if (
            !foundCollection ||
            !foundCollection.operations?.some(
              (operation) => operation.name === tab.collectionName
            )
          ) {
            prev[index] = {
              ...prev[index],
              collectionId: undefined,
              collectionName: undefined,
            };
            prev[index] = {
              ...prev[index],
              collectionId: undefined,
              collectionName: undefined,
            };
            shouldUpdate = true;
          }
        }
      });

      if (shouldUpdate) {
        return [...prev];
      }

      return prev;
    });
  }, [tabs, collections]);

  const saveToCollectionModal = useRef<any>(null);
  const saveToCollectionFormRef = useRef<FormRef>(null);
  const saveToCollection = useCallback(
    (collectionId?: string, collectionName?: string, force = false) => {
      if (!collectionId || !collectionName) {
        if (saveToCollectionFormRef.current) {
          if (saveToCollectionFormRef.current.validate()) {
            const value = saveToCollectionFormRef.current.getValue();

            collectionId = value.collection as string;

            if (/^.*:.*:.*$/.test(collectionId)) {
              collectionId = collectionId.split(":")[2];
            }

            collectionName = value.name as string;
          } else {
            return false;
          }
        } else {
          return false;
        }
      }

      setCollections((prev) => {
        let collection = prev.find(
          (collection) => collection.id === collectionId
        );

        if (!collection) {
          const id = guuid();

          collection = {
            id,
            name: collectionId!,
            operations: [],
          };

          collectionId = id;

          prev.push(collection);
        }

        if (!collection.operations) {
          collection.operations = [];
        }

        const operation = collection.operations.find(
          (operation) => operation.name === collectionName
        );

        if (operation) {
          if (!force) {
            return prev;
          }

          collection.operations = collection.operations.filter(
            (operation) => operation.name !== collectionName
          );
        }

        const operationName =
          getOperationName(activeTab.doc! as any) || (collectionName as string);

        collection.operations.push({
          name: operationName,
          query: activeTab.query,
          variables: activeTab.variables,
        });

        updateActiveTab((prev) => ({
          ...prev,
          collectionId: collectionId as string,
          collectionName: operationName,
        }));

        message({
          type: MessageType.Success,
          text: `Operation "${operationName}" saved to collection "${collection.name}"`,
        });

        return [...prev];
      });

      return true;
    },
    [saveToCollectionFormRef, collections, activeTab]
  );

  const saveToSharedCollectionModal = useRef<any>(null);
  const saveToSharedCollectionFormRef = useRef<FormRef>(null);
  const saveToSharedCollection = useCallback(
    (collectionId?: string, collectionName?: string, force = false) => {
      if (!collectionId || !collectionName) {
        if (saveToCollectionFormRef.current) {
          if (saveToCollectionFormRef.current.validate()) {
            const value = saveToCollectionFormRef.current.getValue();

            collectionId = value.collection as string;

            if (/^.*:.*:.*$/.test(collectionId)) {
              collectionId = collectionId.split(":")[2];
            }

            collectionName = value.name as string;
          } else {
            return false;
          }
        } else {
          return false;
        }
      }

      setSharedCollections((prev) => {
        let collection = prev.find(
          (collection) => collection.id === collectionId
        );

        if (!collection) {
          const id = guuid();

          collection = {
            id,
            name: collectionId!,
            operations: [],
          };

          collectionId = id;

          prev.push(collection);
        }

        if (!collection.operations) {
          collection.operations = [];
        }

        const operation = collection.operations.find(
          (operation) => operation.name === collectionName
        );

        if (operation) {
          if (!force) {
            return prev;
          }

          collection.operations = collection.operations.filter(
            (operation) => operation.name !== collectionName
          );
        }

        const operationName =
          getOperationName(activeTab.doc! as any) || (collectionName as string);

        collection.operations.push({
          name: operationName,
          query: activeTab.query,
          variables: activeTab.variables,
        });

        updateActiveTab((prev) => ({
          ...prev,
          collectionId: collectionId as string,
          collectionName: operationName,
        }));

        message({
          type: MessageType.Success,
          text: `Operation "${operationName}" saved to collection "${collection.name}"`,
        });

        return [...prev];
      });

      return true;
    },
    [saveToCollectionFormRef, sharedCollections, activeTab]
  );

  const showSaveToCollectionModal = useCallback(() => {
    if (activeTab.collectionId && activeTab.collectionName) {
      if (
        collections?.find((collection) => {
          if (collection.id === activeTab.collectionId) {
            return collection.operations?.find(
              (operation) => operation.name === activeTab.collectionName
            );
          }

          return false;
        })
      ) {
        saveToCollection(
          activeTab.collectionId,
          activeTab.collectionName,
          true
        );
      } else if (
        sharedCollections?.find((collection) => {
          if (collection.id === activeTab.collectionId) {
            return collection.operations?.find(
              (operation) => operation.name === activeTab.collectionName
            );
          }

          return false;
        })
      ) {
        saveToSharedCollection(
          activeTab.collectionId,
          activeTab.collectionName,
          true
        );
      }
    } else {
      saveToCollectionFormRef.current?.setValue({
        name: activeTab.doc ? getOperationName(activeTab.doc as any) : "",
      });
      saveToCollectionModal.current?.open();
    }

    if (!collections?.length) {
      saveToCollectionFormRef.current?.setError({
        collection: `No collection has been created. Add a collection in the 'Collection' tab.`,
      });
    } else {
      saveToCollectionFormRef.current?.setError({});
    }
  }, [activeTab, collections, sharedCollections]);

  const showSaveToSharedCollectionModal = useCallback(() => {
    if (
      activeTab.collectionId &&
      activeTab.collectionName &&
      sharedCollections?.find((collection) => {
        if (collection.id === activeTab.collectionId) {
          return collection.operations?.find(
            (operation) => operation.name === activeTab.collectionName
          );
        }

        return false;
      })
    ) {
      saveToSharedCollection(activeTab.collectionId, activeTab.collectionName);
    } else {
      saveToSharedCollectionFormRef.current?.setValue({
        name: activeTab.doc ? getOperationName(activeTab.doc as any) : "",
      });
      saveToSharedCollectionModal.current?.open();
    }

    if (!collections?.length) {
      saveToSharedCollectionFormRef.current?.setError({
        collection: `No collection has been created. Add a collection in the 'Collection' tab.`,
      });
    } else {
      saveToSharedCollectionFormRef.current?.setError({});
    }
  }, [activeTab, sharedCollections]);

  useEffect(() => {
    tabs
      .filter((tab) => tab.collectionId)
      .forEach(
        (tab) => {
          const collection = collections.find(
            (collection) => collection.id === tab.collectionId
          );

          if (collection) {
            const operation = collection.operations.find(
              (operation) => operation.name === tab.collectionName
            );

            if (!operation) {
              setTabs((prev) => {
                const newTabs = [...prev];

                const tabToUpdate = newTabs.find(
                  (newTab) => newTab.id === tab.id
                );

                if (tabToUpdate) {
                  tabToUpdate.collectionId = undefined;
                  tabToUpdate.collectionName = undefined;
                }

                return newTabs;
              });
            }
          }
        },
        [tabs, collections]
      );
  }, [tabs, collections]);

  const getTabName = useCallback((tab: ExplorerTab, i: number = 1) => {
    let tabName: string = tab.doc
      ? getOperationName(tab.doc as any) || `New tab ${i + 1}`
      : `New tab ${i + 1}`;

    if (tab.collectionName) {
      tabName = tab.collectionName;
    }

    if (tab.isHistoryTab) {
      tabName += " [History]";
    }

    return tabName;
  }, []);

  const inputModalIsEndpoint = useMemo(
    () =>
      inputModalFields.length &&
      typeof inputModalFields[0] !== "string" &&
      inputModalFields[0].name === "url",
    [inputModalFields]
  );

  const [layout, setLayout] = useState<[number, number]>(
    localPreferences.get("explorer").layout?.tab ?? [50, 50]
  );

  useEffect(() => {
    localPreferences.set("explorer", {
      ...localPreferences.get("explorer"),
      layout: {
        ...localPreferences.get("explorer").layout,
        tab: layout,
      },
    });
  }, [layout]);

  const currentRef = useRef<HTMLDivElement>(null);
  const handleIsDragging = useRef<boolean>();
  const lastCursorPositionX = useRef<number>();

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    document.body.classList.add("dragging");
    handleIsDragging.current = true;
    lastCursorPositionX.current = e.clientX;
  }, []);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (handleIsDragging.current) {
        const width = currentRef.current?.offsetWidth || 0;
        const newLayout: [number, number] = [...layout];

        newLayout[0] +=
          ((e.clientX - lastCursorPositionX.current!) / width) * 100;
        newLayout[1] -=
          ((e.clientX - lastCursorPositionX.current!) / width) * 100;

        lastCursorPositionX.current = e.clientX;

        setLayout(newLayout);
      }
    },
    [layout]
  );

  const onMouseUp = useCallback(() => {
    document.body.classList.remove("dragging");
    handleIsDragging.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const [saveModalSelectedCollection, setSaveModalSelectedCollection] =
    useState<string>("");

  const [isDrawerVisible, setIsDrawerVisible] = useState<boolean>(false);
  const schemaBasePath = useRef<string>(window.location.pathname);

  if (!ready) {
    return null;
  }

  return (
    <div
      className={styles.explorer}
      onKeyDownCapture={(ev) => {
        if (ev.key === "Enter" && ev.metaKey) {
          ev.preventDefault();
          ev.stopPropagation();

          query();
        }
      }}
    >
      <Drawer
        visible={isDrawerVisible}
        onClose={() => setIsDrawerVisible(false)}
        title="Schema"
      >
        {!!schema && (
          <Schema
            data={formatIntrospectionResponse(schema)}
            theme={props.theme || "light"}
            compact
            navigationMode="query"
          />
        )}
      </Drawer>
      <Modal
        className={classNames(styles.inputModal, {
          [styles.endpointModal]: inputModalIsEndpoint,
        })}
        ref={inputModalRef}
        options={{
          title: inputModalIsEndpoint ? "Set Your GraphQL Endpoint" : "Input",
          buttons: [
            {
              label: "Submit",
              disabled: !!inputModalIsEndpoint && !inputModalData.url,
              handler: submitInputModal,
            },
          ],
        }}
        onClose={onInputModalHide}
      >
        {inputModalIsEndpoint ? (
          <div className={styles.endpointModalContent}>
            <div className={styles.left}>
              <div className={styles.text}>
                To get started with the Inigo Explorer, a valid URL endpoint is
                needed. You can always change it later. Once you provide the
                endpoint URL, the Explorer will be configured and ready to use.
              </div>
              <div className={styles.form}>
                <Form
                  ref={inputFormRef}
                  containerStyle={{ width: "100%" }}
                  onChange={setInputModalData}
                  onSubmit={submitInputModal}
                >
                  {inputModalFields.map((field) =>
                    typeof field === "string" ? (
                      <TextInput key={field} name={field} label={field} />
                    ) : (
                      <TextInput
                        key={field.name}
                        name={field.name}
                        label={field.label ?? field.name}
                        type={field.secured ? "password" : "text"}
                      />
                    )
                  )}
                </Form>
              </div>
            </div>
            <div className={styles.right}>
              <img
                src={
                  props.theme === "dark"
                    ? "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAdoAAAFgCAYAAAActbi8AAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAEaSSURBVHgB7d0JeFzVmSf8995bJWtfjA1ehFU2NhgSbGECuDsNlskEQro72AbSS0gs6NCZnunBwPeleyYhQQby9CydsExPksmkQU4vpAlgO52EJTQWgXRjwiKbTDBg7LKQsQ2ytS9WVd0z5711b6mqdEuqKtVyl//veS6lKpUk20j113nPOe8hAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwOYUAPKBjZz/fNAYjFIoRtWpqoEEXehM/KIQeVhQKxwIU7tjcFCYAgBJC0IJr3fMjI1zbSAlsUgRtkN/NrbN9jFCUMAnqolhk99f+oGkXAQAUGYIWXOfuR4f4pl1Vla3EQZsnDl2FRGdUje7ASBcAigVBC65hjWAVJXAXZQ7Ybhmg3bJePEhCHzAeUbUWRYiQjFY54lUa0z/ACtw7r6vbTgAABYagBVe49/Eh/l79lkzF21LfIwYEKTtkOXhXbCTa3XFT00Cmz/GNR0f4plVXxCaVxFYZsKGUz6Qoh2Nq5EqMbgGgkBC04GjmIqflgVjwifiI1CIDVigPyHC9f6ZwzcQqP2sK3ZUcuBy2aoy2fPWztd0EAFAACFpwLCtkg3rwOWGUfhP2RCPRmzv+aO4jz3t+NGx8KUUGbtLDQs7/3vSVLbU7qMi+8ajxd5SjbHUTFYmmaIe/cn3x/y4AYA9BC46UIWSFHHLececNtfdTAXU8Yn6tgPZc0uhWflm68ms31HVREd372DD/DL4mr1lXTM+B/HdTN995Q81uAoCSCxCAAwViAQ6gh2RChMyHZAYqN3/1+tpOKjA5MuawPRyJxq5MClv55egJGfjrijlnK/9+Qt5sJ0W9lopHxIYnnycAKAuMaMFx7n08Xs6VKWSVc+Mhe93MIXvJnp1808oNKxRVjhAVrUFGzCCReljR9X2vbNzcNdPH245sBb1+5w116wgAIE8IWnCUqcVPgUPWY3LMt12WcDvsnt8aD9dGNRDYRrq+SZm5BDsgx6m7YrHY9u6Nm8N2TzBXJl8kVPEcf97419fl12/oIACAPKgE4CCBiKbIK7EwSU6UHs4Ush+TISvnPjZqqvq6HLF2KLPPczbKT9gun39o3Qv/fJfdE7762Vo5fI69TkK/23pMUdRbOx7ubyQAgDxgRAuOYTOaFdFIdIXd6uKLX/wJ37RTLPYw5UtRHn71is/cbPeu9EVKxRrVmn+PrXI03kaFEovtfnXjZrSXBHAILIYCx+DRrLy5y6qzyHnSzqKFrPEFxE0X/+LHZBe2slzNi5TuUBTiErI1qs1rz+6Mf4RYjP/OtykFXHUsVHWtvEHQAjgEghYcgUezUYo1ytHsVvMhocYiD6Y/j+dkY5HIcln+vY8KQZaS1+3Zuf+1jZtTtgzJcjWParvkm9y4gkOwUa3XeK9rJxWQpusc6DfFiAq2j1b+ntJFAOAYCFpwBC2m8U1b4gFB3V/9bNO07kyappmtGEWh5kzlYFX9ugzwzu6Nm1NGq7JczCG4Wz6h1XgeqVdQgYP2Vxs38023eQGAB2ExFDiEkAEqNkzd06ft++TFT0os1iYTMO/R37k19XYPN8kfhNvSH1QDOl+JJg/KHL4uAPgXghYcQY4W+Vpr3uVORtO6GAn5FHltpTzUBwL0j+s20D9e3EZ/2nLe9K+vqremP/bVzU1yDjXAI01rpNsoS9whAgDIAUrHkDdzlXCjec1JlKKKnJ9NLAjik3imP8v4vXAD5YhD9rtrPk7n1jYYK5zeHhm0e1qjHDG3ZWhqESZzsVIgWrHWvF8QwfO/xDfbhCjIHK2IknIzHfhumADAMRC0kBUzVEPBWOBaXVFaVV1vEzGlICFr+/XSVvcai6B0vVFT1VDy40sqq2jDGYvpJyd6aDganfZ5lsr3/48LLjVCdjgaoW+9+3+p6+Rx26+py79f+mNC1/lmnxzxGkGrq7EmKiA5Dcxzzu1yOF+IVcdCU2ltrIC/CADA3CFoYUYyYBtluG4VMWPE1cYjQoX3vijF24LNB7FneFdKqPOf4I4VH6W2BYvp9846m/79/l+mhC2HLI9kF1dW05AM2X+/71/p7dHBTF+WP11o2qPxyZVE6Ku6KOgvFlFF5X/SzRrJuecCiP3mezg4AMBhELSQ0TceG94mA7ZDzDhqFQOKoILsLU0/iH3W58vr/xx5my5uXEDnyRHr369roz/b/6/0/sRYriE70xfhLzNgtnZRRKFH8Ae+y/8Nxwq8mhkAnANBC9N849H+VqEGHxYpB60zIQNV6Va4GYKuPB8ZjYQL0cDBLEs3yTnaU/yGksPWnbdkeHKIfnftb8twrabvrPltuvut16njvIuMkD0qQ9cK31nEA3X6o/GRbjxohVAzjrYBAGyhBSOkMEaxRPenPioGhFAeiI1EC94ZyWK2POSg5ZAV0eHo/PSvdfHzu5Ofk+K8mgb6649cYoSrJYeQZULR9SvTF0OZfy7uDtVGONcVAPKA7T2QcO/jw3elhiwHLG2PDseWc2P/YoUs43lfeSU+v1YbaLV5El9ddh9vjGxlqB4zQzXHkDVEbZpG8KG0SlJJWxGTRwgAIAcoHYOBQ1aO1zoSDwjqjkZjm+16DReDbpx/Ts9boaaQzkHblfwcJWY86UFZvrXdCsPh+iUZrrww6icn3sspZOV4dlpnKC5pRygSkiXtkPWYXbcqAICZYEQL00NWFzuiI9GNpQpZJgeOvJB5n3WXFPUz6c+RZV3SVbVLzLB9hcP1e0feyi1kube/iN2d/qAa0fhqS3qoiwAAcoSg9bl7/mloU3rI3vnZ+vZilontRAM6X51JD7XZnQGr6rqQ181USPHRbHja11K5DbLyBetZKik7CAAgRygd+xi3E1R19T4RL9uyXRyyVAYdm5t44RGHexfFFx4pWq16G78r+Xk8qv3Ynp17FF3fLlT1Lpoj+Tc/rIvYHdP+PMZpQlEuG7dZj01GIs8TJIRCIb4xmpZEIpFGWfZvTJnPzmG7lvweDJtvDghzrj4QCPBjA+FwuKS/9AEUGoLWxwIRrUOoIsRv8wtdLBq7ncrIPAP2bllCbuP7mc6A5bC9eM/O7aTrjXLYuY3yZISsrl+ZPjfLsj0b16usEJUBGlJVtVWGZgPfivjWK35no3w7ZD1fhiLNhWLTAMX6BbClpYVvwubFQcwL0g7zrfz/Fw4Gg2GEMTgZtvf4FI9m5WjtsHVfTlJu/tof1O+iMkvbTsMJd9+dN9TeYfdcPs1H6shrZCvEnpgQW+xC9u5Hh/jmJlk2fsh6djQSXeHFoDUDNRSLxThMW8ww5YVo/I6itNcsEv7/2C3/7DzPz79A7ZPh340ABidA0PrUvY8OdZKqGCfh8Gjta9fV3kQOcM+PhvlmoxzgPGc+JOQvAVsy/RLQGg/bkMYlZlWd9WQf+UL8ugyUB17dcK3tfKvZPGN5UA8+Z43Y5L/Pw/Lfp7DzwmWQFKpt8t+Ag5UPSDAOtSfvCvMl/18+L8O3C+EL5YCg9aH00awcrS130mjNHNU+IS9rG09/VIuuk/O44UwfYwWurPRyiFxLXNo0excrvD9Wlhm5o1WG03nSv3ZiRC1foA/LkvqVxfz3OdZvlEhDlIdKOZJralJsg2Pp0qV806pp2gb5b9JG8b+Tl0M1Wzzy5W1aXfKXjn1Hjx7Fli0oKgStD8nSaLssiz5s3u268/q6jeQgVkvGYFR7zep/LG8Px9TIlTOF7Vx947Eh/nl4SJDSbj4042i6EE4OR9J/qciV0ImuXFgX7LJGrHLkdi2CNSc84u2St12ydP48T/gSQAFhe48PqWbJ2HiblE5yGF6BTBPUH5EjSTL7DytCLNdkObcYB69zsMurSQbsc0khy4uz7i72vLUSv+YShsr3vn1/27Jly+7n0TdfMmS5uxcHN0I2OyH5b9Yur07+92tpaXmd/z2bm5vbCKAAMKL1GT72TpaN+6370eFoU6n3zGbrG4+O8M1FQhVcyrVCg9v8b7/zurrtVAD3/Mj4p9ioqsGHklfRcutJbjtJJXBsPLfS8S9+/NPGH/5ox6aTfX3Xnur7sHV4eJigaIzRrqwS7Ojt7e0igDwgaH1GBoucwwzsMe4I6r7zhrqLyMGssCVFfyL5GD0uJZMeuflrNzR1UR7M8nRjQNfukp/stuT3lTJks2FttZHziZvU+IIvry9gcireWrQLoQu5QtD6zL0/GryNFPU+444Qu++8oT7fucGS6XjEXAkc0J6zObO2i8vfk1pktyw5zzoyN0ewbaQENslvfg6tpMAS/Yqi3vHV62o7yQFk6ZJv2gKBwFb5Ao9SsLMYI135y88DWEwFs0HQ+sw9PxrskGFi7DsVQpcjt4YOcglz64/881OmfbPcB3mfanR7isb7JuvUKBRqlH9nOQ+n8naWNrIPrD3RSPTmcq++tkavctS0Tc4Z8kgb4ep8PDe+HQupIBN0hvIbZeqFW7E76NzBZDmXR7cd8s3OQFCTt0r6vtk2+Xdq4xlPWR6PP6LN+ttkl1kq7qIyskav8gWbf4los+uUBI613FxIRcuWLetEaRnSIWj9Ro7wrLXmuqq4buO+HHHyTVgGbjvfVTWtTVUVbsPYmv1nEQOCDwgQtKucAYvRq/fw6mVN09pbWlqMUW5PTw8OogAELbiTFbjy6pSh20ncHSqotRK3D1S1FiV5BbGihOXjg0IX3Xow2NWxuSpMZWQGbKsMWN5SspWb8RN4jTHKlYHbwQuoZFn5AZSV/QtBC66XFLp8FXXf61ygPOxLvEf3Nvn//DYuK8vA3Y7A9R80rAAoMg5Ybn4gS4p7+CLrwATwFS4rc0MMGbgPh8yyBvgDghagSBCwYAeB6z8IWoACQ8BCNhC4/oGgBSgQfq2U13IELOQCget9CFqAOTIDlrfp3CdfMA8RAhbyYAbuHhm4txF4CoIWYA7MAcg289QcvEDCXPEq5ftaWloOycDdSuAJ2N4DkIekrTrcNzqHZhkAWTH24cqwbcOWIPfDiBYgB2aZuEm++HWa87AIWSgas5zMo9u7CFwLQQuQpaQy8SHu6EQApSG/3ZQOLifjMHp3QtACzMJaTcwLVeR1P6EnMZSHsaIdq5PdB0ELMIOkUexrhNXE4ABmOfk5LJZyDyyGArBhBiyPYh8iBCw4j7VYaoOqqneEw2HXncTlJxjRAqTBKBbcQobtTfx9Kr9nsSjPwRC0ACZrRbGu6w9jLhZchCsvr2FlsnMhaAEoMYq9iF+weA6MANzFWpn8GhZKOQ+CFnzPfF26zSwVhwjAvfiXxefOPvvsTQSOgaAF30orFd9HAN6wXFXVJ1BKdg4ELfhS0qpilIrBi6xS8nMoJZcfghZ8R5bVKBaLbUapGHxgI5eSEbblhaAFX+HXG03TOri0RlhVDP5gVG4wb1s+CFrwhbT5WMxdgd80Yd62fBC04HlJ87HPYT4WfMyYt5Vh+y2CkkLQgqclhyzhSDsATtvbzUVSmDopEQQteFZSEwoO2RABgGWj2boxRFB0CFrwpObmZopGoxsRsgAZLceK5NJA0ILn8OtGIBBo1zSNQxblMYDMELYlgKAFTzFfL/i8zocJALKxHCcAFReCFjzDDNkOhCxAzprMkS3CtggQtOAJSSGLfYIA+UHYFgmCFlwPIQtQMAjbIkDQgqshZAEKDmFbYAhacK2khU8IWYDCQtgWEIIWXAmriwGKjsP2CWz9mTsELbhOUscnhCxAcWGfbQEgaMFV0noXA0DxIWznCEELrpEWsuj4BFA6y80yMn7u8oCgBVdIC9kQAUCpXaTrOo7YywOCFlxBBqzCv1ETQhagbBRFuQnn2eYOQQuOJ3+wOWT5hxtbDQDKTIbtbfJn8jaCrAUIwMHMkvFdMmh99YOtzaunqoXnEzhLZOQonR7oJZ+TWat8q7m5ubu3t7eLYFYIWnCss88+m2Kx2GZVVX3VkKKi/mxadf0/yttmAmcJzuulN//+SzR89Dfkc4qmabw4al1YIpgRSsfgSDySlT/Iy2XI+m4+iEeyCFlnqpp/Nq279RFaeOFVBInuUViJPAsELTiOWS5u8usKY21eHYFzBaoaaM0t36Oz224ioOVYiTw7lI7BceQPriJvvi7ngUJUIEp1FWkL5lOgZWnisVjfKYoeOUpibJwAcnXulrtk6NbT4ScfID+TP6fty5Yt2y+rT/ejimwPQQuOYo5mtxVi8ROHa+Xll1HFugspeP6qjM+L9vTS5Ktv0MQLe0mX4QuQrRXX3G7c+jxsjcVR8rZL/vx2I2ynQ9CCYyQ1pZjz4qeqq9qoass1pMqwNYxPEJ0aIDp6YupJ8xuIli6iwLJm46refA1NPN1FozufxCgXssZhW9nYTG8+8mXyMWOfuwzci+Xb/QQpELTgGNyUQt7Mqb2iKsvDdbd8bmoEezBM9PTzRO+fiIetnXNaiC5tJbpkLVVe3UbBdWto8K8exOgWsrbkt26gqgXNtP/7X6Lo+BD5FP+S/JAsI2/u6ekhmILFUOAISU0pQpQnDtmGr9waD1kevf6vHUTf/gHRu0cyhyzj9z+ym+jeB42P0xbOp6Z7/kKOcpcSQLaaVv0WXfaXP6XK+b5eMX6tvG7D+QOpELRQdrxfVoZsO3ecoTxZIcsLnqj3ONE3vxcP0FxwOHPY/mIvKTXV1PBf/hPCFnJSOf9suvjWR/wctjxf+3VCq9QUCFooq6T9sl+nOeBycSJkv/ODmUews9n1dCJs67bdYiyqAsgWwtbYmvewrFIRxCFooax4K4+8ePFTiPI07/LLpsrFnY/OLWQtHLZyfpfLyDWbryGAXHDYXvYXP6W6pReQT20glJATELRQNkkl462UL4WM1cIGXvTEYVsoP/yxcVN51QajNA2Qi0B1A10q52wXX3o9+ZC15QcHgRCCFsqkUCXjeb9zWbxkfLKf6Ff7qKA4tPlzKoqxHxcgdwpdcONf0/JrtpEP8QLH+1BCRtBCmRSiZMzmrbsw/sYzv6C8bbqa6FtfN7b3TPNyt3FTddUGAsgX77X1adiihEwIWiiDgpSMmRxpBlbLuVlBua8wtvzRZ4iumGG0eii+NYgXRKF8DHPBYXvulq+Rz2AVMiFoocTMknHTXEvGTFvQRGpNlQzC8elzs5XziM4JZf5gfj+H7CXmFBLP79qVnjnEuemFLAHO1MYRIBtnt/0Jrfni/zZ6JPuIsQqZf8H2KwQtlAPX0EI0R4kR5vsfTH/nzX9A9B+/QHS1TcmXQ/Y/bp0KWW5WwUGbycRpAiiUhWuupov/0yN05kpfzfvzD+Imv5aQ0YLRY0LtOxvr9dptQsRCdu8/3je4YfGZTcbbvznQu/XCzz9V8snHyRP/1k4FoC2tzPzOX79FtDI0FbRWkFohu3RR/D6H7GyLqHi0rFB80RVAAdQ2f4TW3fpDauo/Qh+8s5cO7H2CjspbD1PMs6W75FXArQHugKD1mDq9+nVBeojnL+1MnI4k3h4dO92W6XnFVLHot6kQlDpd/ncyHp7pfiFftKoq40HLV1NDPGx5pMshy3ttH/qn7OZ25zcaJeQYeh9DAUXkb2/9TS208rKldP76LTR08qgRth4OXT67lhdGdfjthB8ErYdceOPTm8hHiw7EiPlLAp/CY8caxXLQ8qEBl5qlYg5Z7oF89DhlpSn++fW+kwT+putUUBy2h0WQllGU6s9YKq8tng5dRVFulTed8gqTjyBoPUSoeqtiTrurA6+RNvDqtOco5/BC3zPjzzn5SwqGu8jVTv2+DMLG+MKnd8PT389hy8HKW3hYriHLWc4laCGMQ+LB32KTsrRRU9gqUExeh0WAlsi3GpR4kns4dI2FUc3NzRt7e3vJLxC0HqVM9pMyenj647Gp9oTqxDHb57gKz8Xy9pyVLfZBy7iMzPOsvPhp99O5dY/6WHxvLR8OjzNqYWKQaJ4scKhFWEb6vtDkRIhCC5VYyuN2oXt4/8/p0P5nyaV44UQbxedrfQFBC+72xoF40F5+qQzUl+SINcMKYQ5kvnLFTSzkIGb8mecJQMgB51CvoPrFsnYUpILrE/EETw9bS3Lonh4bMsLWhaGraJp2lxzVdvllVIugBXfjxUy8z5XLu9y9afczVDAcsvLzxj7so9MvvEwATI8SDbwnSKvgpbRUcENyVFtxhkINVWLG582rrjcC16Wh66tRLYIW3I/nYTlor1gvR61vZy4h54IXQPEiKvlaN7brKQJIF5ukopmIkAza7J+fKXSPHtwr7w+TA/Go9qFly5at6OnpIa9DwwpwPx7VctjyGpWbP5tYJZw3/njeazu/kU6/ug+jWXAVK3Q//affoVv++2vy9tt0/mVb5ON15DAhec2tDatLaASecebaG9sUUtr4bXX0MKljqQudll34KWpZ8ykKVtYa9yvM28EPDpLrcdjyNp+W5vg2nuERovdPUM6WnEX0pc8ZIRv78CQNffO7RJEolVLVwguo8ZyrCPxrfo2g2nlUEE1nnUMr1n6SLv7kl2hB8/kUCMyj4f5eikWKOCTPDvdBXtvQ0PDA4OAgeRlKxz5Q3bCI1l93LzWctTLl8QXLWo1rYUsr7f/531Dk9EjmT3JOS7xxQyHwFpt8FibN5pEfxxdD8eKoP7o2/mfmkW5/Fj/E3PRiw/r4x1ZVUvRILw098H2sNAZPWbHmk8b1Cfpvsrz8czq871k69MazZnlZUBmEKD6q3UEehqD1gcs/d78RtpnwSDc4r5ZeevxO+ydYpdRCyqb1YT52PR0P8uQmFXzUHQc7b+tJHuVyuPLcLu/BvXRtvJOUNPF0F43ufBIhC542FboU36f70hPUe/BlGj7J+8VLFro8qr1LztXu8PJcLYLW48655PqUkB0bPJ64P3jiYGKUu/jc3zFGt3093dM/SVUluYp1Eg+HLa8cTu4KxTiIbf5OkTffobFdT8pbD5TSAXKwdNVlxsXKELoh8vioFkHrcS1ytGrZ/+zfUMOZK415WnbwV48ZQbtShrH1XNug5VEgj0ALWTouxmg2GY9erVN5ZAlZrF9v9DhWKkQiZPWxMYodOUqRAwfl9Q4CFoDKEro8qt3W3Ny8w6v7ahG0Hpc8L/uuDNZ1v/ufU97f88ZTiaBd0NKa+RMVOxiLhQNXXuIdjaJL43/P6NBrNPb6dwnAqY5GVBqd1KlJI6pRBVWU/uwPQwlDl1982sij+2oRtD7C87BcOrakL36KTIyQH+hjEwTgdKO6Ii9+SzHC1uOh6+luUQhaj0uek10mS8YHXuxMhO2xt1+kdb83NcLlOduMeAUvLxxyIl7s1O/t7QHgbz4JXc92i0LQetyR/U/R+Ze3G2+v+Xd/btz2Hek2RrN8P3kO9/13XrT/JMVYdVxIfL4sny0L4ANOD91D5pahPEKXR7XbQqFQl9fOq0XQety7rzxmLH6yRrVW2KbrkYHMI1xbpzM06neKcZSCwVuWBnWqrRDUH1NoRIZqRNinaHro1svQrXdA6F5+/Vepr/dN2renk97cu5NyCNxr5cWrLnM4Ysv5ELQex/OuL/zDbTPupeWA5RXJGfGc5r0PxsvHTlSM5hcAZVajxkeqbELI0I0qNJhF6B6ToVupyJFuoLyhy12oPvH5/0ZLzr2M/uXv/jLbD1N0Xb9N3naQhyBofYDnZJ/+9h8ajSn4qjEDd+CDg8ZKZNstPenM1bsAUHqVMiwXBwUtpuxCd0I+fizijNA9/7LN9P7be+XI9omsnq8oyq3Nzc0dXloUhaD1Ed7KwxcAuFchQrdG3laV7EgZRY5qL806aCleOm4jDy2Kwuk9AAAuZYXu6nmCzpuny7d1I0wziYeuQgcnVXrrtGq8Pa5T0dU3Lc3l6cZWn1AoRF6BES0AgAdwWXiBxpegSTnSHZIByqPdiQwj3UmZx30xxbj4Y7m03KgVY6Qr6NAbP6cc8VYfzyyKwogWAMBjrNBdleVI1wrdoox05ec+tO9fKEfWoihPwIgWAMDD0ke6vDKZtw3xKmU76SPdGnOkW5vnsKyv9zc0fOoo5UpRlCvIIxC0HiUqmkivXk4Qp1cuJgC/4+CskKHblEPoTsr395uh28Ij45wCV9CbL++kPLU1Nze39fb2dpHLIWg9RFaGwmT+vOiN64wLphMTJwnA7/IJ3d6oSisrcqgpG2XjZylPiqqqbeSB1ceYo/UQTavcJW/CBBnpE300eeJfCQCmcOhyK8cVFfE53WY5crWaZSRTc+xjnG/Z2MJ7askDMKL1kO7OjQOt7XsuisUmNumkbKAiE8PvtsbGPmgllxCnT9Jk77+QiI4RgJNFqHwyjXQ13koUyCVo51Q2tjR6oXyMoPUYDlt502leRdPS0sL1pecIAAruAz6P9rSY80KkuUoO3ZzNrWxs4fIx9z/uIhdD6RhyxhvJZUknRPHuLQBQBDwnyiPJw+aWm95I/IABt5hr2dgiX2uuJZdD0ELOYrEYX20EACXhvtAVtK/rB1QgoZDL20QhaCFnspTD5ZzPEAAURaU6c3MJK3R/Y4buYIychVcov7OXCoSbV7STi2GOFvLVRgBQFGfIOdEF8+JtFId0hYZi9ltuYmboGouVovE2inXyatCorPgA+EKUjS1ub16BoIWcmBWcNiFEIwFA0WjmlhteiBQLuCl0BR3YO+fVxuna5GtPYzgcdmXvYwQt5ESWcPin/Fr5GyYBQGnYhS43luDj8XSbQwPSQ5ePxavX4uGrFftHt7Bl44RYLLaJirybolgQtJATM2CLvkcXAOwlh26zvD8UE8ZId6bQHZKPDxmLpxQjbIsZuoUuG5vkS4+yllwKQQtZM8vGjbJs7JomFQBeZ4RmlqHLjPJz0UK3KGVjg7nN53ZyIQQtZI239UhtqorF6gBOZBe6vA0okkPocpOMinxDt0hlY5OxzUfO04bJZRC0kDUlXjdG2RjABazQZaO6MOZrsw1dDtslci64MsffqYtUNk4w9+93kstgaAJZ45yVF4IWwGVq5Ct9c1DQ6nmCVlToxvxucIaD4Hmh1aFJ1ZjfzV7xysYmxa3bfDCihaxgfhbAGzh0rZN5Zhrp5twDo7hlY4MM2jZyIYxoIRcIWQAPyTTSVeV1ViC3BVLFLhubeJrWdXv4MaKFrOi6MXmzAftnAbwpeaSbu6KXjZPx9NVuchGMaCErShzmZwFKYEKWcSfzzbxyKEHZ2MR9jy8il8GI1gEu/PyT7fJ3nmvl95CDSyKCooNvtREUnahvpvffeSXj+wMVVVQ3fzFV1c0n8KaTUYWGTqvGCLNprltuSqBEZWOL6xpXIGjLaHX7k6Ggru6Rb4bijzj7V9hA43kExceLUMZH+md4Rr98UXtfhu0SWtB8LqlakMCbePXvaNKWG6u5hLNCt6RlY3JjhygEbZlMD9kpVZXz5FVBAJbxidPymkx5jMNWj0Vo0QqsUfMDK3SPydCtVORIN+CQ0C1d2dgSctsBAwjaMglG1Q45Qx5Kfmx+Yx2tCi01bgHSDY2M0ZsHe+jUwHDisdHBD43Rb1VtE4F38OhVyDDN1FyC53CPRZwRuiUuG1tctSAKQVsuKvftnCoVrwotoZUyZAEyqa+tpstaV8uwfY/CvccTjw9+cARB6zGNmqCz5gkZqIL6o/F9rhM5hC6f1lNVkqWupS0bW3RdX04ugqAtgwvaf9pK+tR5rksXLUDIQtbOX3m2HN2OJka2p8dHCLypUmbr4mD8F/JJET8ej4N3ttDlOV0e3fIol0O7aKFb+rIx47/8GnIRbO8pgwpSU+YWljefSQC5WJX0i1l0cpzA+zg4F2jy/70c6Z43T5cBrBsj2Ex4e1BfTKGDkyq9dVqVAazQuE4FVaayMS+IctXCBIxoyywY0KiutiblseG+g7T/yQ4CYIGKWrrgE1+mugXnJB6rk2XkZBEZtsGKKgJ/sEJ3gRytZjPStUKXL2ukWyc/tnZOQ63ylI1NIXIRBG0ZdHdeE77wC08bbwcC0/8XvPPid2hi6AQBxJ2g9/Y9YYSthX9B49XpvBqZiRjXCxG0fpQeurwymfsX8yplO+mhywuvzgzksZCqPGVjS6ObVh6jdFw2SsZvkMq6RQSQbKTv0LTHkreARSYnCIDDkhtcrKiIl5ebZXl5praKHLocygdP53pST/nKxklC5BII2rIRRtBGo9Fp7wlU1BBAssjp6QuekoNWt/k+An/LJXS5Scqos47Em1UsFnPNPC1Kx+UiRFjO6Ici0RjxxaVAS2BeLQEkmxiePpUQTJp2iGBBFMyAQ7dCI+N0HrvyMp/YU5lL6bi8ZWODoji5ZW0qBG3ZTJWOeVSbHLSV9WcRQDqet0/+3uA5WksUpWPIUnroRkR8G5EDj8SbCf9pW8glUDouF0UftN60FrRYghUY0cJ0kcnU8nFy0OrGYiiA3MQXQ+UWsk4oG5tC5BII2jKRv0SGrbcj0dTNbZX1WAwF6QSNfHgw5ZHkOVrspYWScUDZmMnSMUa0MDMhpkrHkbSFLEHM0YKNyORoyv3k6YZYLEbgHcN6vO2iEzmgbGzBHC3MTDVWHcfrNemlY6w6Bjvpe6tT52gxovWSoZhC45OqUdI1mkvIq0EjB3BM2ZiFyCUwoi0XMdWGcVrQyhEtVh5Duuik3RafqbDFymPviZn7XHsiKv3mtEq9EYUGy1m8cEjZ2MJNK8gFELRlEgtEwzO9PzAPo1pINVvTCoEFUZ7mhNB1UNnY4oqgRem4TPhgAetnJP1Ab4bycfHF1DqKafaVg4rIMXKa2ZpWcHeoiqp6AvdrCggKaoIG5TytbtO/2ApdvigSLy/Xa/Hb3FYQ58JRZWMLghZmUilLx/GAtQvaqrpFtiMYt5gMLp72WEybHmyTFdOfp6u1xnNTPtYIxbrpX8fm47P9nDNZcuw+WnDyh+Qkdk0rUrb4oDuUZ1Qrgs4KCmomnq/lQwOUjKHL+P1DxuIppXih67CyMYtGowhayKy7c+OAdbCAbRvGPOdoxyvPNcLMLtRYxCYAJ4NLpj1mfY7Ux7L/nG43WeHMLVYzNa3AHK03GaGplT90HVg25i0+IXIBBG15heVltGFMV1mXe3eo/sbfpfeav04ws2Dk/WmPabEReQ2bbw/Tgr5/IifiphWVNPW9kdyGEd2hvM8udHkbUCSL0OU+x9z7mG9zPqnHmWVj10DQlpH8Xh+w+njzyuPk0Uk+e2kzzTeWymwBNvXYsPF4Ort5UbvHcvmcQQfOteYv3rQi+VzalIMFsBjKV6zQZaO6MOZrZwpd7mvMPY4rFIVa+ND4XJbCyi9zaP/PCfKDoC0jIcSArH0Yb8fLx1NBq+Wx6rhp4GdGGTg9cO3DSgaTPpL2mF8DzD3Sm1ZgLy0wbqNoncwzW+jy0XiDMnQr1eyP6+GQPT0+TA6joHQMs1PEEatpxdhEhOqS8rEqjzNpORSXHL+PwLvSm1Zwd6iAvKJy+gHdoYBlE7oVSi5n4gk6vP9fCPKHoC0jQcqA9a2f3oaxCv2OwYZd0wqep+WgxYgW0qWH7ogcydbK+zUoG5cUGlaUlUg5Ki8Z9tGCndmaVmDlMWTC4XpWIMeQJceWjV0FQVtGsnoTtt5O30uLFoxgZ7amFegOBYWFsnEhoHTsEBGbvbS8XzJ9Ts5Pahqn788NVtZSRWVd2vNSy+wfhF+n0QFnL9bSq5eTfsbHSVTltgeZY7Trpf2pjyVtDzv6zqukau78sQ5WVFHd/CVUd8YSAodA2bggELRlJDQKK+ZRWKVsw5htgMUfq83q4+0/Z920j7d7Hj8nWJl916bZRGSZ68cPXEeRCWeWu/S6Cyi67EbKV/ohFCmfOxY1LjfifcDjI/00fOp9WrLqYwTlh7JxYSBoy0j+44etsUjUpmlFPm0Yz1v/B3SuvCx2weZ1wUpnl91ji3+XIDMO24EPjlDjma4517vgPoyppMV0o6NT7s0lCgVl40JB0DqEXXeofOZpP9r2JwUdHZaaXcl3Uo5MIxOpc5M8Wp2cGLH9eC4dO3U0K2qWkwg2EcxsQoYt+ThoJ2Wl61hEoWOkUKUiqClApQ9dlI0LBkFbRt2d14Stfsd25cB8SsdvvfSoEbbpZgqmfJ6X6TH+2FxC0e/U0UOkHX2M/E7UrKDo0usT92MuLX8Xw4SQgSsn563QtXoXVxV5KSvKxoWDoC2/sLxC/EZ6G8Z89tL+uuv7xgXuoUQGyPci/QSz49CdkL+DfCBDl0e3HLiNWjFC1xVlYyGFyQUQtA6m4fB3AF86MyCoMqhTf1QxwtUOt1LsiynGVfDQRdm4oBC05ca/kZn9OqcdLFCBvbQAfhSUJeIFskS8QAbnpBDGCTy5hm6d/NjaPEMXZePCQtCWW0q/40man/SuSrRhBI+oblhkzN3bNdyAmXFwJocun8DD/Yv5NB476aGb80k9LlptjNIx5Cy9DWMQ3aHAxfj7d/Xl7dRy4acSW67GBo9TzxtP0cGXH0Po5oGDs0KGblMOoXtCjoRbKnI4RABl44JD0JaZ/J4OTx0skLrFJ5/D38HFrriMaEmBqhjvhol+tY/KpeGsVXT5H983bU8zj2xX/047LbvwanrhH243ghfyk23oajluCXJT2TgQCLhiJSGCtsyEUAbMI2ntt/jIUUG0QL/523VqYulNLXLpCGX3OTM9xo4eeJ5+3fW3BGk+eh7RpqupYC5ZS3RqMB64JVbdsJjWX3dPSshaW76sx6znPPfQLQRzlyl0+XFeWJU9QQf27iQXCZMLIGjLTDVO8LEOf7drWlGTU9ByGF626U5qWrTKkY0rms5aiaC1Mz5BBTdenpN8Vl++1Ri5Mh6xvvqT/0p9Pd3G/WWyjLzm3/25Ebg86j3nkuvp3V9hH3EhJYduribGhuSI9llyi3A4jBEtzG62fsdVdbkdLNAoA/bM0Dpyqg+OvEZg490jRPc+SHROgbohnZKvP++X40AKhRYuazXfFvTmC53U9+EJ0lq/Lr+ZF9NR+ejIoXkyaOOr68fO+Bxpv/UJEmoVqUkHLChakE6O5B4UFk2duoIaX2XrY+gqh10UspJrNqAjaMtMJ31AM08rtGvDWFnHI4P9lK0Pwq8ZHZesMm9hOj2lztdwGXDSpsXh6MDxWT8nukHNgMPxlPubV1ijWV6AwAuf1I/cQUrz7yXeP8Tf5qPmncBSUs5YSnYxOFnA5lCKwvtSybwQuvaE24I2TC6BoC2zClIHpg4WmP7KkmsbRg7Bf75/CwGUC38PWnOxvPI4OvgWlZuctqTxyfilqYJqK+UvBBUI3GRuKxsTRrSQreR+xzyi5SsY0BLvxwHwPnL1Blk6DpHj8FzvLvk92j+Y1dMHPzhIC7h8rCh0/uXttP/Zv6HY+FQlY80n/5wazlxpvP3+2y8ac7T6vCUppxrNq6qjBc3nUb5icjomqgviIlEkFr+f/L7BMVnCnhDUWK1QBV4FDS4bzbpmDy3Dt5gjKPI3M9HIb/GoNjlo+fB38AFedcxB61S8Iv6R3Vk8UdCR/U/Fg1bixU48uuVA5dFty5pPyfetIJ404ee+8m8PkuAtPjX9pDf99tRnka9Mcw/AqRErh+3oaWGUo63Q5VueB66R08X1VX4f3bqubMx6yCUQtI7AK4/JCFq0YfQpXrjEK4+rKsmRDoazfirPyy5oaTUaVTBeabzMfDvZmy/sKNk+Wl4QxaNXxuXjYTmatQJ39DTPBwtqqlGMxVNOcDyqUiSiU50ab6NY7LVcLiwbu+ZAAYagdQD5MzRgra+MRPWU96ENo0/wIqhvfo+oqYEch/fj9uc2HfbaT/6rMVe78pLrbd/P5eRybeupquDRsmKE7bi50J9HvDy6PaPWGWEbE/F9sHwx7l1sHY9XjNB14WgWpWPIjRAUlmlr1NoiaMPoXx5ZdWx5wwxTLh9bvY55/rZHlpbL3X6Rw5RHuAE1PrplVil5YZ1CisMqyUO6YhwswL+WFz50XVk25q5QYXIJBK0TKPogmVt80rtD5XP4O4BTcGmYA9epePWxpio0MDYVtqdG4yNbpyp06LqwbMwGwhK5BILWAQQpA9bPyLSglSPaQrZhBIBUXErm0LLClhdM8cKpmnnlC9ulQZ2qgsII1REZqpEMx+Mlh26NDNtm+TG57lpy42iWXLSHljlk6t/vxIz1wgAOgAcoKg7busqphBqZSN0SVA48UuXgXD1P0IoK3WipyOfUZsKHCfREcn1Jd2fZWM7PHiEXwYjWAZT4HK3Brg0jyscAxcdl5NPR+IhWl3nGI1ynlJBrVDJGrGxU/uF4kZTdSDcqcmtb6dKyMSvf0VR5QNA6gVAHZgraqrpFNNJ3iPzA/oQgPk2oLu1501dj84lByQcpcLvHw90/IyfTg00UW/gJ8jtR0UROwPtp+4anSsh8Oa2hRabQ5Q5zi3L8s7q0bCxUVX2dXARB6wAioA8oerzkY9uGsQArj7MNsFyOyJvLsXmZPr6whNF/mfs/O8Zk2iyBDJjYmQjadMGKKioH3m/LZWRr2w+vSHbywqjk0M2dO8vGJpSOITfyf0LY6ndsf7BAbt2hPtr2RTpv/WcdeUye3ymRflJGD5GoWUGQWdPi8v378CKo8cmpUS1XY5223acQXFw25hXH3eQiCFpHqJTDnKmS8bTuUDmOaN0WsvanBg0nDgu35HoSkeNGs6bA0ccpEvqiMZqFVKoWkCF7TtlGtIxHtVwutk4PGpss7wrkYnHxaNZVIcsQtA7Q3blxwDpYgMXLx1NBq+W46vitlx6Vo9o/yTqYCnOUXv6h6Dc8qq1453/IUe1y0qvnNnJbuOLjVLtg6nPwHP/R433G23Xzl1CgwqEtHW0E51VRTcNCGbZBKjc+Ts8KWr6tmUceI+jA3p3kRkIIVy2EYgha5wjLK8RvjE1EqC5pEFtVl1sbxl93fd+4wNmU0cOkyWsuFl14ES0OLU3c52qIFbRVtU1Ud8YSgtzxmbVD41PlY68Z6uulo+/sJRfihVBd5DLYR+tA6W0Yq9DvGDIYHz6Rcj8QmPrdORaLEOSHWzRa87K81Ufku97IoY4efJlczHUjWgStUyQ1yE5feYx9tJDJRFrQ8hGLAfOYxejkBEH+kg8XiJa5eUVhubdsLIXd1HrRgqB1CmWq00n6Xloc/g6ZRCdHpz1mLaTTYx6seZZQctDqJQ7aYn45F5eNXTk/yxC0DhSx2UuLA+DBzvCH7057rKrSaN5LkclxgvypSQuNYyWuHR+LqPTWaVXeKjRe4NR1cdmY/yc8Ty6ExVAOIb+DwlMHC6ANI2THbkQbROnYE3grb19MMS4+KIBP6GnUBFXNaXjk6rIxuXEhFMOI1iGMfsemqE3TilxXHoM/8KlO6We7TpWOsRjKK6zQPTgZH+lO5jnAdnPZmFzYqMKCoHUgu+5QmKeFTGKnU0e1yXO0CFvv4ZA9LAM3lkfYunm1sZyfdWXZmCFoHUJoUyPa9DNpGUrHYE/QcN/BlEeSu4rFsCDKkzhs+TCB3Li6bMz7Z3eRSyFoHSKQdpBx+qgWe2khk2ha6bjaXAxlvA/ztJ41keOI1uVlY4YRLRRW+l5aDYe/QwYzNa2InsbKY6/K9cXb5U0qut24f9aCoHWI7s5rwsn308vHwQrM0YI9u6YVVvkY3aG8q0HLZUjr7tXGbp6fZQhaR1ESh5WOpW3xqUTpGDKw2+KD7lDeFlSEcRZttlxeNha6ru8mF0PQOopIBG166TiIVceQwUxNK9Adyptqc3zldnnZONzb29tFLoagdZKkfsfpi6FyPfwd/MNuRFttlo7RHcqbmvxVNu4il0PQOspU6dh2iw9GtWBjpqYVKB17j9/KxqqqurpszBC0TqLog9abUdumFVh5DPbSm1ZYc7RoWOE9PisbczcoBC0UjqDkphXT+x1XoXwMtjI3rUB3KO/xWdnYtU0qkiFoHUSIqdKxXRvGSvQ7hgxmalqB7lDe4cPVxj8gD0DQOog6w6pjgJmkN61IbsOIeVrvwGpjd0LQOolQU0a0WHkM2UpvWsESC6LQHcozsNrYnRC0DhILRMPJ99NHtTj8HTKZqWkFukN5gw9XGz9IHoGgdZAKmhrRsmlNK9CGETKYqWkFSsfe4LOycbdbz561g6B1lMqUoB2bSB2JYB8tZDJT0wp0h/IGH5WNhaIoD5CHIGgdpLtzY0rQRtJGtDgqDzKZqWkFukO5n8/KxszVhwikQ9A6T9h6I707FA5/h5lMTDsuDwcLeIWfysZCiE43H4lnB0HrMApR0haf1FXHXDpG+RjsCZoYOp7ySH1ttXGLhhXu56eysaqqd5PHIGgdRv42l7TFZ/rcGtowQibpTSuCiTaM6A7lZj4rG3d5bTTLELROo4gj1pt2bRhRPoZMZmpage5Q7lXvn7IxL4LaQR6EoHUYkXKCj12/YyyIAnszNq3APK1r+ahszINZBC2UwsxtGNEdCjKx2+KTeB+6Q7kSl42r/FE25tHsdvKoAIGjyJ+rMK+IYlYbRmuujS1rvc4YuaTPx4G/8SK5cz/+Z9Met1auozuUO/mobOzZ0SxD0Drc0eMfUqh5qlzMI9o1n/bsL35QQCf6prZlo3TsTn4pGwshPHFKTyYoHTuM0Kb20bJw7we2R+YBzObNgz2Jt9Edyn18VDY+rKpqJ3kYgtZhAlSZ0t+TS38vdx9A2EJO9h84nNLwpKIK+6/dxi9lYz6lx4tbepIhaB3GaMOYdjzU0MgY/fKV/0u9x/ts99YCMP7eODkwZHyvHJXfK8lqGs8kcBeflI092aAiHeZoHUj+hrddUZS25Md4dPKGHKW8Qan7IwEs6S07LQ1nLqNgRRWBewRVf5SN5Wvd3UeOHAmTxyFoHejXf39N14Wff/ImUtSH7d6f6QUVIF3dGUtowdLzCNylKcda4+E3niUX8vzcrAWlY4d64++u6dRUfTmRvoOSmlgAZKOytonObPkInbnsIwTuwwuhsiYEvenCsjGvNPb63KxFIXCF1X/4ZIhcKtb3SlPkvZ2vEWSl8ZyraOmGr1O+NE0jVQsSzM3AmKBxszlbQzVRdUXpXi5Xnhmjs+qzC9uhvvfoBx1XksscliXjFeQTKB27xIEfXhNOf2x1uzvCV1u6rl8/8fMdsdMjW63HFHLOKmr9tLMKBoqYlHOqlQSQDReWjT3dBcoOgtZlQu07G2ujVR2Kqm4lXTSSK6gUvOir0x/Vx0iL9MtgKX/onv5wH40e/YUM3UECcA13lo093QXKDoLWRXgEG9TVPTK3Qryc3+10tZr0edVG2GqxYSqneQvXUsX882jkyM+N0AVwg6GTvdTX+ya5iNB1/Q7yGSyGcolEyBKHrLfEgk0ydMu/ZUnRKqm25ZOkzmsgADdwW9lYCNH53nvv7SKfwYjWJSpiYpNQUkM2ENAoGHDn/8L0LUp6QIbb8NtUcjJc1cDUfCiHbd2Kz9Dgm39HAI7mvrKxL5pT2EHQuoWibU2+uyq0hFaGlpJbhXtPpPbilSPawV8/RCI6RqVW3XwFVS+9InE/UIMuSuB8bisb+6U5hR2Ujl1Czsi2Jt9vaXb3AfCh5rOorrY66RGF1NpmKoex3l+krDxWtCpZPnbJOjPwLZeVjQ/39PR0kE8haF0q+Yxat/LC3wGgLNxVNvblAqhkCFqXwmk+AP7lprKxXxdAJUPQukc45U7vcXIzPpHo1EDylh5B+sRJKoeqRZemlYqF45pYACRzUdn4sF8XQCXDYiiXkC/9O+Qs5l3W/YPh9+mDvgFj5bHbROVonIM2mYgMU/3yT1OpKYF5FKhOne+e7C/D6meAbLmnbGx0gPJLP+OZIGhdIqBW3h/TI9vk925i6JUeVm4WoAhp9S3kBCNHnqFymhx6n8DfKmdoVe2WsjGXjI8cOeKrDlCZlO1QAW4lWK/XbpP/M9oIsqOIEHmwYQUJnVQxSU6gx05TdLT8Zfm65vUE5SVqlpFavTB+Z+Q9EuMfUCkE5IRe9bzMnd+GTx01wtbptJrmbiVQ64g5GCH07kBgfHt35+ay/HnKNqKt06tfl+XQEM4PAlJU0hWHNNFXKynQWP7OUOMj/QTlVVG5OLGIZXJ8iKIl/H8yc0PSGvk96oozhlud0ipWlrDbdL16g3xzHZVBWRZDfbT9yTby4sgMAAAciXsRfPRGI3tKrixBq8QQsgAAUFqKGihLuaosQatplbvkXxn7JwAAoESUAU2NluVorrIEbXfnxgHSxU2UtjcUAACg8JR+0qM3d3deE6YyKPtSpNV/+GSIAJLETr7SFO3954eEHm0lgDJpWL+dKkO8t1vQ0EsdNB7+GYE9Ndj4QMVHv3w/OdSBH5YnYC1l30db7n8AcJ5QKBSWN1uEEK/JW3T3hzJQSETHE/f4VClRps5lLnBYP32qQ76WYzowA7RgBMcxG8kcVhRlCwGAk/HP6ZXyZxYhOwMELTiSGbZ7uIUbAYATcYvFO9BicXYIWnAs/vnVdX27LCGjjRuAw/BB7vJn1Nen8mQLQQuOpqqqkNft8s1uAgBHkCF7v58Pcs8VghYczaxK9ZvztWECgHJ7XYbs7QRZQ9CC46UtjsKiC4DywSLFPCBowRXMsH0dP+QAZWOtMA4T5ARBC66RtBL5DgKAUjKmbxCy+UHQgquYP+f3YdsPQMnwNp6b5c8eFiTmCUELrmOGbQfCFqDorJDFNp45QNCCKyXtsX2AAKAozL2ynQRzgqAF1+rp6RHy5nY0tAAoPPlztR17ZQsDQQuuZobtTQhbgMJByBYWghZcD2ELUDgI2cLTCMADBgcHqaGhYbd8M6QoCs6xhbw0LzuH1q2/ki5e30aBxW00pM8nPjLvohaVLv7I2RSsqKBoZJLGx0bJixCyxVH2g98BCmnZsmX8Pc3bf7YRQBZWrV5Lay7+OF12+dVUXV2bePwXhxvl1WS8/fl1x6ilcSLxvt6ed2nP04/TwTe76WTfCfIChGzxIGjBc0KhEN90yBeOuwgggzMWnEU33vKXtOr8tbbvn4iq9NaH1dRYGaWWpgnb55zsO057X3iGfrbT1bMW1nF39xMUBYIWPAlhCzPZeNV1dM2WL6SMYNnY2Ai98eqL9F7PIVkeHqFTMkjZ/AWLjGDmUF61evrMRN+Hx+j7D9xljHRdxton20lQNAha8DQZuAhbSKiurqEtn/tzWn/5VSmPvyNLwD/b9QN5u2/Wz1Elw5lLzZ/e/AUZvotS3veznT9w0+jWaqvYRVBUCFrwPBm27TJsHybwNR693vqVb1LzspWJx3p7DtLj//DtrALWDs/rpgeuS8L2sBmyaKtYAlh1DJ43MDDQ3dTUxCuSPyWvRgIfUqj9P9xJ554/Vfbd8/Rj9H9kuffUHBYzHZWl4v2v/puxoKq+cb7xGJeXeVVy+N03yaGsU3gOEJQEghZ8QYbtcTNsNxHC1nc+vXkrXX7l7yfu84jzx4/+LRUCz+W+ureLLrjwkkTYXnDhx+idt/bNKcSLZI8ZsscJSgZBC74hw3bADFse1oQIfOGMhYvoT7fdnbjPIcvl3dko1VVU/x/aSVtyFkUOHJzxuby3NiVsFYVWrl5De198xnifE8jpk/t7enr+WP4YTBCUFIIWfIXDdnBwcIcMXF6f0EbgaXL0Rn95z/9OrC7ufuVF+qcd2Z1DwSFbcfEaCp6/isTYOEXfDc/4fA7U37zxCq3/nauMxhbVNXXGY+8cyG/+t4CM7TtHjhzBaVdlghaM4EuydMbH7N1O4GmXytCzFirJER098Y/fyerjqjdfY4Rs4v6mT1Fg2dJZP+5U3zH66a6p0XLbVVuMVcplZM3HYo9sGSFowbf4xUe+CC3nNwk8SKH1l1+duLf3hacT+2JnwgHLQZvymWqqqW7bLaQumD/rxz//zBNGIwvGo9r0rUQlZM3HdhGUFYIWfE2+CIXli9FGeeFga485Y+FZxmpgxqPZn+36u1k/hoO09pbP2b5PWzif6rf9yWyfwvhaXU89nrh/4UUfp1Lj+VhZKuaQDROUHYIWfC8ct1mGLeawPGTl6qnWityQYrbRLIdsw1duJbW6KuNzAi1nU+3nttBs9v7y54m3ebtPCcvH3IRic09PD6ZFHARBC2Ay521RSvaIVUlB+8br/zrr8+vkSFbLojRceXUbVclrJmOjI4lFULzqLlM/5QLjUvE6+X2M6ozDIGgBkpil5Itwtq3bKca2HoMs5c7Wg5jnZHl1cbZq/niLfP7KGZ4hv+YRc0uQohh9kouIVxXfjlKxcyFoAdLI16oBWXprly9eNxFGt64ks43mm+Em5HXqw8xl46qr2qYtfpr9CxDVfvHGGRdHJX/N+cULWqwqdgEELUAGfKIJL5TC6NbDZGDOu+IyygcvjqrelDmgx8anDoevrir8HC0veDJLxV0EjhYgAMjILMW1h0KhLvMUoBCBd8jh7vjTeyi4eqpszCVhbcEZtk+ffHU/6WPjifsTz3RRGfAo9mZZKu4icAUELUAWeHTLYavrOi+Y2krgGadfeNm4LDxSbfpmx7TnRX7zNg098H3KVvK87MmThel5bK6Mv5+nNwhcA6VjgCzx6BZzt+4g5Ei190h8ARSv+l3aspJKS6GlScfx8cEDc8Qrii/ilfEIWfdB0ALkiEe3smy3HPtunUxM7ZtVFFq1eg2VlBJvmBH/o8y+6nkG/UkrinF2rEshaAHyZO27xWIpZ0pu5r/07NKOaLlsbB0wPyZHs/kcLG8udlqBFcXuh6AFmIOkcvJmQjnZUd45sJ/GR+Ml23PPX1uqphGGazZ9YerPkXvIGmVi7u6EMrE3IGgBCoC78fDoFvO3zjE+Okwvvfh0/I4sH19z7ReoFPi0oESoy7Lx3l8+k+2HdvF2MpSJvQdBC1AgvBPI3Htrzd+GCcpq/2tTrRdLNaptu/q6xNF8fXKeeP+rv5ztQ3i7TrsM2I3YE+tNCFqAAjO74HWYpwIhcMuIy7aJoJOj2s998ctFbfC/anUrbbzaPHRAED0584lBA/z9IQOW52Exz+9hCFqAIjBHt2FC4JaZoMf+4TuJudoFCxfTLbcWZ7E4j2Jv/NMvJ+6/9MJTxhm4NoyA5coHL6gj8DyNAKBoBgYG+BpobGzk+bfd8hqkeHepRoKS4D2sJ469Rxev32jc58MGzjjjrJSycjK1psr2dB79w5N0+sWXbT+GQ/bWr3xzqmT84TH6++//dfr+WS4R3y6vP5MB+5T8tpgg8AWFAKCkQqEQ37SjpWNpfXrzF+Q11dSLw/B//tX/Ryf7pndt4oMGtJalKY+dfmEvRQ4cnPbcNRd/nG685S+o2ixJj44O04N/9f/T0Z7Ec/mXrO2Yf/UvBC1AmSQFLr/6txEUXXrY8ohzz9NP0M925j5Fyntlr5Gfa/3lVyceSwtZBCwYELQAZWYGbsjso3wtoaxcVOlhy072HTcWTnU9/fiMXZyqq2uM1oobr77OGMmmfo5j9LcP3j3w3pF3HiD0I4YkCFoAhzADl0N2kxzlbpO3rQRFMX/BYtr2lb9OzKkm405OR4+8a7Rw5ADmVcpcFuZ+yXyubLXNquW3D+zrenLnw9uffeonXQSQBkEL4EBpo9wNhLncorhMln15hGsXuFkR1EVCbP/9jau6CCADBC2Aw5mh2yZDtx2l5eLgMvCadR83bqtn2WcrBIWF0HerpOxCwEI2ELQALmKG7iYZupsw0i2O5mXn0PyFi4ySMS94qq6tC9fXz9990SVtXTEa7tq88SLMvUJOELQALpU00t1kjnRDBIXCK4af51usGoa5QtACeIA1p0vxbULXCiH4FiXm7HG3pl2xWOx5TdN2YcUwFBKCFsCDrNGuvNbK0N1E8RXMCN4pRrDKWz4lZ7fZLhOgKBC0AD5gBi+HbassNbfJkFlL/tk+xKPTbvkLxz55dcsRaxeCFUoJQQvgYzKA2yi+jag1KXzdPPINy79Ht/z7HEGoglMgaAEgIalphhG4HMCqqrbI0AolPV5OPDrlsm+3+Xa3nFcdlIHK98OYWwUnQtACQNaSgjhk3jbKoGuUwWe8g0PZfGqjDOesR8by48PW2zwa5Vv58cZjMkT5lq8BBCkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUzP8DQaQiMHbZJVcAAAAASUVORK5CYII="
                    : "data:image/png;base64,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"
                }
                width={175}
                alt=""
              />
            </div>
          </div>
        ) : (
          <Form ref={inputFormRef} containerStyle={{ width: "100%" }}>
            {inputModalFields.map((field) =>
              typeof field === "string" ? (
                <TextInput key={field} name={field} label={field} />
              ) : (
                <TextInput
                  key={field.name}
                  name={field.name}
                  label={field.label ?? field.name}
                  type={field.secured ? "password" : "text"}
                />
              )
            )}
          </Form>
        )}
      </Modal>
      <Modal
        ref={saveToCollectionModal}
        options={{
          title: "Save to collection",
          buttons: [
            {
              label: "Cancel",
              tertiary: true,
              handler: (close) => close(),
            },
            {
              label: "Save",
              handler: (close) => {
                const values =
                  saveToCollectionFormRef.current?.getValue() as any;
                let collectionId = values.collection as string;

                let isShared = sharedCollections.some(
                  (collection) => collection.id === collectionId
                );

                if (/^.*:.*:.*$/.test(collectionId)) {
                  collectionId = collectionId.split(":")[2];
                } else {
                  isShared = values.shared;
                }

                if (isShared) {
                  saveToSharedCollection();
                } else {
                  saveToCollection();
                }

                close();
              },
            },
          ],
        }}
      >
        <Form
          ref={saveToCollectionFormRef}
          containerStyle={{ width: "100%" }}
          style={{ gridTemplateColumns: "1fr" }}
          onChange={(values: any) => {
            setSaveModalSelectedCollection(values.collection);
          }}
          onSubmit={() => {
            let collectionId = saveToCollectionFormRef.current?.getValue()
              .collection as string;

            if (/^.*:.*:.*$/.test(collectionId)) {
              collectionId = collectionId.split(":")[2];
            }

            const isShared = sharedCollections.some(
              (collection) => collection.id === collectionId
            );

            if (isShared) {
              saveToSharedCollection();
            } else {
              saveToCollection();
            }

            saveToCollectionModal.current?.close();
          }}
        >
          {!(!!activeTab.doc && getOperationName(activeTab.doc as any)) && (
            <TextInput name="name" label="Name" required />
          )}
          {/* <Select name="collection" label="Collection" required>
            {[...collections, ...sharedCollections]
              .sort((a, b) => {
                return a.name.localeCompare(b.name);
              })
              .map((collection) => {
                const isShared = sharedCollections.find((sharedCollection) => sharedCollection.id === collection.id);

                return (
                  <SelectOption value={collection.id}>
                    <div className={styles.collectionsOption}>
                      <Icon icon={isShared ? <IconUnlocked /> : <IconLocked />} size={16} />
                      {collection.name}
                    </div>
                  </SelectOption>
                );
              })}
          </Select> */}
          <AutoComplete
            name="collection"
            label="Collection"
            placeholder={
              [...collections, ...sharedCollections].length
                ? "Select existing or create new collection"
                : "Enter collection name"
            }
            options={[...collections, ...sharedCollections].map((entry) => {
              const collection = collections.find((item) => entry === item);
              const sharedCollection = sharedCollections.find(
                (item) => entry === item
              );

              if (sharedCollection) {
                return `shared:${sharedCollection.name}:${sharedCollection.id}`;
              }

              return `personal:${collection?.name}:${collection?.id}`;
            })}
            renderOption={(value) => {
              const [type, name] = value.split(":");

              return (
                <div className={styles.collectionsOption}>
                  <Icon
                    icon={type ? <IconUnlocked /> : <IconLocked />}
                    size={16}
                  />
                  {name}
                </div>
              );
            }}
            renderValue={(value) => {
              const [, name] = value.split(":");

              return name;
            }}
          />
          {props.access === "admin" &&
            !/^.*:.*:.*$/.test(saveModalSelectedCollection) && (
              <Checkbox name="shared" style={{ width: "100%" }}>
                Make collection shared
              </Checkbox>
            )}
        </Form>
      </Modal>
      <Modal
        ref={saveToSharedCollectionModal}
        options={{
          title: "Save to shared collection",
          buttons: [
            {
              label: "Cancel",
              tertiary: true,
              handler: (close) => close(),
            },
            {
              label: "Save",
              handler: (close) => {
                if (saveToSharedCollection()) {
                  close();
                }
              },
            },
          ],
        }}
      >
        <Form
          ref={saveToSharedCollectionFormRef}
          containerStyle={{ width: "100%" }}
          style={{ gridTemplateColumns: "1fr" }}
          onSubmit={() => saveToSharedCollection()}
        >
          <TextInput name="name" label="Name" required />
          <Select name="collection" label="Collection" required>
            {sharedCollections.map((collection) => (
              <SelectOption value={collection.id}>
                {collection.name}
              </SelectOption>
            ))}
          </Select>
        </Form>
      </Modal>
      <div className={styles.preflightModalContainer}>
        <Modal
          ref={preflightModalRef}
          options={{
            title: (
              <>
                <span>Preflight script</span>
                {props.access === "user" && !import.meta.env.VITE_EXPLORER && (
                  <Tooltip text="Only admin or owner can edit preflight script">
                    <Icon icon={<IconInfo />} size={24} />
                  </Tooltip>
                )}
              </>
            ),
            buttons: [
              {
                label: "Cancel",
                tertiary: true,
                handler: (close) => {
                  close();
                },
              },
              ...(props.access === "admin" || import.meta.env.VITE_EXPLORER
                ? [
                    {
                      label: "Done",
                      handler: (close: () => void) => {
                        close();
                      },
                    },
                  ]
                : []),
            ],
          }}
        >
          <div className={styles.body}>
            <CodeEditor
              className={styles.editor}
              defaultValue={preflightScript}
              onChange={setPreflightScript}
              defaultLanguage="javascript"
              readOnly={
                props.access === "user" && !import.meta.env.VITE_EXPLORER
              }
              theme={props.theme}
              extraLib={`
            declare type ObjectFromList<T extends ReadonlyArray<string>, V = string> = {
              [K in T extends ReadonlyArray<infer U> ? U : never]: V;
            };

            declare const inigo: {
              environment: {
                set: (key: string, value: any) => void;
                get: (key: string) => any;
              };
              input: <TFields extends ReadonlyArray<string>>(fields: TFields) => Promise<ObjectFromList<TFields, string | undefined>>;
              fetcher: (options: {
                query: string;
                variables?: Record<string, any>;
                headers?: Record<string, string>;
              }) => Promise<Response>;
            };
            `}
            />
          </div>
        </Modal>
        <Modal
          ref={envVariablesModalRef}
          options={{
            title: "Environment variables",
            buttons: [
              {
                label: "Cancel",
                tertiary: true,
                handler: (close) => {
                  close();
                },
              },
              {
                label: "Done",
                handler: (close) => {
                  close();
                },
              },
            ],
          }}
        >
          <CodeEditor
            ref={envVariablesEditorRef}
            className={styles.editor}
            defaultLanguage="json"
            wordWrap="on"
            defaultValue={envVariables}
            onChange={(value) => throttledSetEnvVariables(value)}
            theme={props.theme}
          />
        </Modal>
      </div>
      <div className={styles.main}>
        <ExplorerSidebar
          url={url}
          schema={schema}
          introspectionLoading={introspectionLoading}
          tab={activeTab}
          history={history}
          tabs={tabs}
          cursorPosition={queryCursorPosition}
          deleteHistory={deleteHistory}
          deleteHistoryItem={deleteHistoryItem}
          collections={collections}
          selectedOperationName={selectedOperationName}
          onCollectionsUpdate={(update) => setCollections(update)}
          onCollectionCreate={(collection) => {
            setCollections((prev) => [...prev, collection]);

            message({
              type: MessageType.Success,
              text: "Collection has been created",
            });
          }}
          sharedCollections={sharedCollections}
          onSharedCollectionsUpdate={setSharedCollections}
          onSharedCollectionCreate={(collection) => {
            setSharedCollections((prev) => [...prev, collection]);

            message({
              type: MessageType.Success,
              text: "Shared collection has been created",
            });
          }}
          onUrlRestore={() => setUrl(props.defaultState?.url || "")}
          hasProxy={!!props.request}
          proxyEnabled={proxyEnabled}
          onProxyEnabledChange={setProxyEnabled}
          historyEnabled={historyEnabled}
          onHistoryEnabledChange={setHistoryEnabled}
          onTabActivate={(id) => {
            setActiveTabId(id);

            setTimeout(() => {
              scrollInnerRef.current
                ?.querySelector(
                  `[data-name="${getTabName(
                    getTabById(id, tabsRef.current) || tabs[0]
                  )}"][data-active="true"]`
                )
                ?.scrollIntoView({
                  block: "end",
                  inline: "end",
                });
            }, 200);
          }}
          onTabCreate={(tab) => setTabs((prev) => [...prev, tab])}
          onTabUpdate={(update) => {
            updateActiveTab(update);

            queueMicrotask(() => {
              requestRef.current?.focusQueryEditor(queryCursorPosition);
            });
          }}
          onUrlChange={(value) => throttledSetUrl(value)}
          serviceKey={props.serviceKey}
          theme={props.theme}
          onShowSchemaDrawer={() => setIsDrawerVisible(true)}
        />
        {activeTab && (
          <div className={styles.tab}>
            <div className={classNames(styles.navigation)}>
              <div className={classNames(styles.inner, "disableScrollbar")}>
                <div className={styles.tabs}>
                  <div className={styles.scrollContainer}>
                    <div
                      className={classNames(styles.scrollButton, styles.Left, {
                        [styles.Visible]: canScrollLeft,
                      })}
                    >
                      <div
                        tabIndex={0}
                        className={styles.Inner}
                        onClick={scrollLeft}
                      >
                        <Icon size={12} icon={<ArrowLeft />} />
                      </div>
                    </div>
                    <div
                      ref={scrollInnerRef}
                      className={styles.Inner}
                      onScroll={(ev) =>
                        setScrollLeftPosition(ev.currentTarget.scrollLeft)
                      }
                    >
                      {tabs.map((tab, i) => {
                        const tabName = getTabName(tab, i);

                        return (
                          <div
                            className={classNames(
                              styles.tab,
                              activeTab.id === tab.id && styles.active,
                              !!tab.collectionId && styles.hasCollection
                            )}
                            onClick={() => setActiveTabId(tab.id)}
                            data-name={tabName}
                            data-active={activeTab.id === tab.id}
                          >
                            {tab.collectionId && (
                              <Icon
                                icon={<IconCollectionsFilled />}
                                size={12}
                                className={styles.collectionIcon}
                              />
                            )}
                            <div className={styles.label}>
                              <Tooltip
                                truncated
                                text={tabName}
                                popupStyle={{
                                  padding: "var(--gutter-extra-small)",
                                }}
                                position={TooltipPosition.Bottom}
                              >
                                {tabName}
                              </Tooltip>
                            </div>
                            <div
                              className={styles.close}
                              onClick={() => deleteTabById(tab.id)}
                            >
                              <Icon icon={<Close />} size={12} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div
                      className={classNames(styles.scrollButton, styles.Right, {
                        [styles.Visible]: canScrollRight,
                      })}
                    >
                      <div
                        tabIndex={0}
                        className={styles.Inner}
                        onClick={scrollRight}
                      >
                        <Icon size={12} icon={<ArrowRight />} />
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  label="Add tab"
                  type="text"
                  icon={<AddCircle />}
                  onClick={() => {
                    const id = guuid();

                    setTabs((prev) => {
                      const newTabs = [...prev];

                      newTabs.push({
                        id,
                        query: "",
                        variables: "",
                      });

                      return newTabs;
                    });

                    setActiveTabId(id);
                  }}
                />
              </div>
            </div>
            <div
              ref={currentRef}
              className={styles.current}
              style={{
                gridTemplateColumns: `minmax(100px, calc(${layout[0]}% - 8px)) 16px minmax(100px, calc(${layout[1]}% - 8px))`,
              }}
            >
              <ExplorerRequest
                ref={requestRef}
                theme={props.theme}
                schema={schema}
                tab={activeTab}
                url={url}
                proxyEnabled={proxyEnabled}
                headers={headers}
                onQuery={query}
                onHeadersUpdate={setHeaders}
                onTabUpdate={(update) => updateActiveTab(update)}
                onSaveToCollection={showSaveToCollectionModal}
                onSaveToSharedCollection={showSaveToSharedCollectionModal}
                preflightEnabled={preflightEnabled}
                onPreflightEnabledChange={setPreflightEnabled}
                onPreflightModalOpen={() => preflightModalRef.current?.open()}
                onEnvVariablesModalOpen={() =>
                  envVariablesModalRef.current?.open()
                }
                onSelectedOperationNameChange={setSelectedOperationName}
                onCursorPositionChange={setQueryCursorPosition}
                isSubscriptionActive={isSubscriptionActive}
                terminateSubscription={terminateSubscription}
              />
              <div className={styles.handle} onMouseDown={onMouseDown} />
              <ExplorerResponse
                theme={props.theme}
                tab={activeTab}
                url={url}
                envVariables={envVariables}
                headers={headers}
                schema={schema}
                isLoading={isLoading}
                preflightFailed={preflightFailed}
                preflightOutput={preflightOutput}
                isSubscriptionActive={isSubscriptionActive}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

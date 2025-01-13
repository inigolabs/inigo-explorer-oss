import classNames from "classnames";
import {
  buildClientSchema,
  getOperationAST,
  IntrospectionObjectType,
  IntrospectionQuery,
} from "graphql";
import { escapeRegExp } from "lodash";
import moment from "moment";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ExplorerCollection,
  ExplorerCollectionOperation,
  ExplorerTab,
  ExplorerTabHistoryItem,
  guuid,
} from "../../Explorer";
import {
  addAllScalarTypeFieldsToQuery,
  addAllTypeFieldsToQuery,
  addAllTypeFieldsToQueryRecursively,
  addArgToField,
  addFieldToQuery,
  areAllTypeFieldsInQuery,
  isArgInQuery,
  isFieldInQuery,
  removeArgFromField,
  removeFieldFromQuery,
  removeTypeFieldsFromQuery,
} from "../../Explorer.utils";
import NewButton, {
  ButtonSize,
  ButtonVariant,
} from "../../../components/Buttons/Button";
import Button from "../../../components/Button/Button";
import Checkbox from "../../../components/Checkbox/Checkbox";
import {
  CheckboxRef,
  CheckboxVariant,
} from "../../../components/Checkbox/Checkbox.types";
import Form, { FormRef } from "../../../components/Form/Form";
import Icon, {
  Add,
  AddCircle,
  ArrowDown,
  ArrowRight,
  Check,
  Close,
  IconCheckCircle,
  IconCode,
  IconCollections,
  IconDocs,
  IconEdit,
  IconFolder,
  IconHistory,
  IconInfo,
  IconLocked,
  IconRestore,
  IconSearch,
  IconSettings,
  IconSortingArrows,
  IconUnlocked,
  IconWarning,
  IconWarningFilled,
  More,
  Trash,
} from "../../../components/Icon/Icon";
import Loader from "../../../components/Loader/Loader";
import Menu, { Option as MenuOption } from "../../../components/Menu/Menu";
import { MessageType } from "../../../components/MessagesWrapper/MessagesWrapper.types";
import { message } from "../../../components/MessagesWrapper/MessagesWrapper.utils";
import Modal from "../../../components/Modal/Modal";
import TextInput, {
  TextInputRef,
} from "../../../components/TextInput/TextInput";
import Tooltip, { TooltipPosition } from "../../../components/Tooltip/Tooltip";
import { IconLink } from "../../../components/Icon/Icon";
import PopConfirm from "../../../components/PopConfirm/PopConfirm";
import {
  addQueryParamsListener,
  getQueryParamByName,
  removeQueryParamsListener,
  updateQueryParamByName,
} from "../../../utils/queryParams";
import { Maybe } from "../../../utils/types";
import styles from "./Sidebar.module.css";
import { renderStringWithSearch } from "../../../utils/helpers";

enum ExplorerSidebarTabs {
  Docs = "docs",
  Collections = "collections",
  History = "history",
  Settings = "settings",
}

const EXPLORER_SIDEBAR_TABS_ICONS_MAP: Record<string, JSX.Element> = {
  [ExplorerSidebarTabs.Docs]: <IconDocs />,
  [ExplorerSidebarTabs.Collections]: <IconCollections />,
  [ExplorerSidebarTabs.History]: <IconHistory />,
  [ExplorerSidebarTabs.Settings]: <IconSettings />,
};

const EXPLORER_SIDEBAR_TABS_LABEL_MAP: Record<string, string> = {
  [ExplorerSidebarTabs.Docs]: "Query builder",
  [ExplorerSidebarTabs.Collections]: "Collections",
  [ExplorerSidebarTabs.History]: "History",
  [ExplorerSidebarTabs.Settings]: "Connection settings",
};

export interface ExplorerSidebarProps {
  url: string;
  proxyEnabled: boolean;
  hasProxy: boolean;
  historyEnabled: boolean;
  tab: Maybe<ExplorerTab>;
  tabs: ExplorerTab[];
  theme?: "light" | "dark";
  access?: "admin" | "user";
  serviceKey?: Maybe<{
    name: string;
    label?: Maybe<string>;
  }>;
  history?: ExplorerTabHistoryItem[];
  schema?: IntrospectionQuery;
  deleteHistory: () => void;
  deleteHistoryItem: (item: ExplorerTabHistoryItem) => void;
  introspectionLoading?: boolean;
  collections: ExplorerCollection[];
  sharedCollections: ExplorerCollection[];
  selectedOperationName?: string;
  onCollectionsUpdate?: (
    update: (prev: ExplorerCollection[]) => ExplorerCollection[]
  ) => void;
  onCollectionCreate?: (collection: ExplorerCollection) => void;
  onSharedCollectionsUpdate?: (
    update: (prev: ExplorerCollection[]) => ExplorerCollection[]
  ) => void;
  onSharedCollectionCreate?: (collection: ExplorerCollection) => void;
  onUrlChange?: (url: string) => void;
  onProxyEnabledChange?: (proxyEnabled: boolean) => void;
  onHistoryEnabledChange?: (historyEnabled: boolean) => void;
  onUrlRestore?: () => void;
  onTabUpdate?: (update: (prev: ExplorerTab) => ExplorerTab) => void;
  onTabCreate?: (tab: ExplorerTab) => void;
  onTabActivate?: (id: string) => void;
  onShowSchemaDrawer?: () => void;
  cursorPosition?: { lineNumber: number; column: number };
}

export enum ExplorerSidebarSorting {
  Asc = "asc",
  Desc = "desc",
  None = "none",
}

const ExplorerSidebarSortingNextLabel = {
  [ExplorerSidebarSorting.Asc]: "Sort alphabetically descending",
  [ExplorerSidebarSorting.Desc]: "Remove field sorting",
  [ExplorerSidebarSorting.None]: "Sort alphabetically ascending",
};

function ExplorerSidebarDocs(props: ExplorerSidebarProps) {
  const defaultDocsPath = useMemo(() => {
    return getQueryParamByName("docsPath") || null;
  }, []);

  const searchInputRef = useRef<TextInputRef>(null);
  const [searchValue, setSearchValue] = useState<string>("");
  const [docsPath, setDocsPath] = useState<string | null>(defaultDocsPath);
  const [sorting, setSorting] = useState<ExplorerSidebarSorting>(
    ExplorerSidebarSorting.None
  );

  const onQueryParamsChangeHandler = useCallback(
    (params: Record<string, any>) => {
      if (params.docsPath !== docsPath) {
        setDocsPath(params.docsPath || null);
      }
    },
    []
  );

  // useEffect(() => {
  //   setDocsPath(null);
  // }, [props.url]);

  useEffect(() => {
    setSearchValue("");
    searchInputRef.current?.setValue("");
  }, [docsPath]);

  useEffect(() => {
    addQueryParamsListener(onQueryParamsChangeHandler);

    return () => removeQueryParamsListener(onQueryParamsChangeHandler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docsPath]);

  const getObjectTypeFieldTypeObjectTypeName = useCallback(
    (type: any): string | null => {
      if (!type) {
        return null;
      }

      if (type.kind === "NON_NULL") {
        return getObjectTypeFieldTypeObjectTypeName(type.ofType);
      }

      if (type.kind === "LIST") {
        return getObjectTypeFieldTypeObjectTypeName(type.ofType);
      }

      return type.name;
    },
    []
  );

  const getObjectType = useCallback(
    (path: string | null) => {
      if (!props.schema?.__schema) {
        return null;
      }

      const queryType: IntrospectionObjectType | null =
        (props.schema.__schema.types.find(
          (type) =>
            type.name === (props.schema!.__schema.queryType?.name ?? "Query")
        ) as IntrospectionObjectType) || null;

      const mutationType: IntrospectionObjectType | null =
        (props.schema.__schema.types.find(
          (type) =>
            type.name ===
            (props.schema!.__schema.mutationType?.name ?? "Mutation")
        ) as IntrospectionObjectType) || null;

      const subscriptionType: IntrospectionObjectType | null =
        (props.schema.__schema.types.find(
          (type) =>
            type.name ===
            (props.schema!.__schema.subscriptionType?.name ?? "Subscription")
        ) as IntrospectionObjectType) || null;

      if (!path) {
        const result = {
          kind: "OBJECT",
          name: "Root",
          description: "",
          fields: [],
          interfaces: [],
        } satisfies IntrospectionObjectType;

        if (queryType) {
          result.fields.push(queryType as never);
        }

        if (mutationType) {
          result.fields.push(mutationType as never);
        }

        if (subscriptionType) {
          result.fields.push(subscriptionType as never);
        }

        return result;
      }

      const pathParts = path.split(".");
      let objectType: IntrospectionObjectType | null = null;

      if (pathParts[0].toLowerCase() === "query") {
        objectType = queryType;
      } else if (pathParts[0].toLowerCase() === "mutation") {
        objectType = mutationType;
      } else if (pathParts[0].toLowerCase() === "subscription") {
        objectType = subscriptionType;
      }

      if (!objectType) {
        return null;
      }

      for (let i = 1; i < pathParts.length; i++) {
        const pathPart = pathParts[i];

        if (i === 0) {
          objectType = props.schema.__schema!.types.find(
            (type) => type.name === pathPart
          ) as IntrospectionObjectType;
        } else {
          const field = objectType?.fields.find(
            (field) => field.name === pathPart
          );

          if (field) {
            const fieldTypeName = getObjectTypeFieldTypeObjectTypeName(
              field.type
            );

            if (fieldTypeName) {
              objectType = props.schema.__schema!.types.find(
                (type) => type.name === fieldTypeName
              ) as IntrospectionObjectType;
            }
          }
        }
      }

      return objectType || null;
    },
    [props.schema]
  );

  const fullAst = useMemo(() => {
    if (props.tab?.doc) {
      return getOperationAST(props.tab.doc);
    }

    return null;
  }, [props.tab?.doc]);

  const ast = useMemo(() => {
    if (props.tab?.doc) {
      return (
        getOperationAST(props.tab.doc, props.selectedOperationName) || fullAst
      );
    }

    return null;
  }, [props.tab?.doc, props.selectedOperationName, fullAst]);

  // const activeAliasName = useMemo(() => {
  //   if (!props.cursorPosition || !ast || !docsPath) {
  //     return null;
  //   }

  //   const { lineNumber } = props.cursorPosition;

  //   let path: string = ast.operation;
  //   let nodes: FieldNode[] = [];

  //   visit(ast, {
  //     enter(node) {
  //       if (!node.loc || node.loc.startToken?.line > lineNumber) {
  //         return;
  //       }

  //       if (node.kind === "Field") {
  //         path = `${path}.${node.name.value}`;

  //         if (path === docsPath) {
  //           nodes.push(node);
  //         }
  //       }
  //     },
  //     leave(node) {
  //       if (node.kind === "Field") {
  //         path = path.substring(0, path.lastIndexOf("."));
  //       }
  //     },
  //   });

  //   return nodes[nodes.length - 1]?.alias?.value || null;
  // }, [props.cursorPosition, fullAst, docsPath]);

  const getObjectTypeFieldTypeName = useCallback(
    (type: any): string | null => {
      if (!type) {
        return null;
      }

      if (type.kind === "NON_NULL") {
        return `${getObjectTypeFieldTypeName(type.ofType)}!`;
      }

      if (type.kind === "LIST") {
        return `[${getObjectTypeFieldTypeName(type.ofType)}]`;
      }

      return type.name;
    },
    [props.tab?.doc]
  );

  const getObjectTypeFieldKind = useCallback(
    (type: any): string | null => {
      if (!type) {
        return null;
      }

      if (type.kind === "NON_NULL") {
        return getObjectTypeFieldKind(type.ofType);
      }

      if (type.kind === "LIST") {
        return getObjectTypeFieldKind(type.ofType);
      }

      return type.kind;
    },
    [props.tab?.doc]
  );

  const typeStringToIntrospectionTypeRef = useCallback((type: string): any => {
    if (!type) {
      return null;
    }

    if (type.endsWith("!")) {
      return {
        kind: "NON_NULL",
        ofType: typeStringToIntrospectionTypeRef(type.slice(0, -1)),
      };
    }

    if (type.startsWith("[") && type.endsWith("]")) {
      return {
        kind: "LIST",
        ofType: typeStringToIntrospectionTypeRef(type.slice(1, -1)),
      };
    }

    const typeDefinition = props.schema?.__schema.types.find(
      (schemaType) => schemaType.name === type
    );

    if (!typeDefinition) {
      return {
        kind: "SCALAR",
        name: type,
      };
    }

    return typeDefinition;
  }, []);

  const inputTypeToJsonMock = useCallback(
    (type: any): any => {
      if (!type) {
        return null;
      }

      if (type.kind === "NON_NULL") {
        return inputTypeToJsonMock(type.ofType);
      }

      if (type.kind === "LIST") {
        return [inputTypeToJsonMock(type.ofType)];
      }

      if (type.kind === "SCALAR") {
        switch (type.name) {
          case "Int":
            return 0;
          case "Float":
            return 0.0;
          case "Boolean":
            return false;
          case "String":
            return "";
          case "ID":
            return "";
          default:
            return null;
        }
      }

      if (type.kind === "ENUM") {
        if (!type.enumValues) {
          const foundType = props.schema?.__schema.types.find(
            (schemaType) => schemaType.name === type.name
          );

          if (foundType) {
            type = foundType;
          }
        }

        if (type.enumValues) {
          return type.enumValues[0].name;
        }
      }

      if (type.kind === "INPUT_OBJECT") {
        if (!type.inputFields) {
          const foundType = props.schema?.__schema.types.find(
            (schemaType) => schemaType.name === type.name
          );

          if (foundType) {
            type = foundType;
          }
        }

        if (type.inputFields) {
          return Object.fromEntries(
            type.inputFields.map((field: any) => [
              field.name,
              inputTypeToJsonMock(field.type),
            ])
          );
        }
      }

      return null;
    },
    [props.schema]
  );

  const pushDocsPath = useCallback(
    (path: string) => {
      setDocsPath((prev: string | null) => {
        let result: string;

        if (prev) {
          result = `${prev}.${path}`;
        } else {
          result = path;
        }

        updateQueryParamByName("docsPath", result);

        return result;
      });
    },
    [docsPath]
  );

  const objectType = useMemo(
    () => getObjectType(docsPath),
    [docsPath, getObjectType]
  );

  const args = useMemo(() => {
    if (!docsPath) {
      return [];
    }

    const parentObjectType = getObjectType(
      docsPath.split(".").slice(0, -1).join(".")
    );

    if (!parentObjectType) {
      return [];
    }

    const field = parentObjectType.fields.find(
      (field) => field.name === docsPath?.split(".").slice(-1)[0]
    );

    if (!field) {
      return [];
    }

    return field.args;
  }, [docsPath, getObjectType]);

  const docsPathParts = useMemo(() => {
    if (!docsPath) {
      return [];
    }

    return docsPath.split(".");
  }, [docsPath]);

  const fieldsToRender = useMemo(() => {
    if (!objectType) {
      return [];
    }

    return (
      objectType.fields?.filter((field) => {
        if (!searchValue) {
          return true;
        }

        return new RegExp(escapeRegExp(searchValue.toLowerCase())).test(
          field.name.toLowerCase()
        );
      }) ?? []
    );
  }, [objectType, searchValue]);

  const inputRef = useRef<TextInputRef>(null);

  useEffect(() => {
    if (inputRef.current && inputRef.current.getValue() !== props.url) {
      inputRef.current.setValue(props.url);
      setDocsPath(null);
    }
  }, [props.url]);

  const clientSchema = useMemo(() => {
    if (!props.schema) {
      return null;
    }

    return buildClientSchema(props.schema);
  }, [props.schema]);

  const updateSorting = useCallback(() => {
    if (sorting === ExplorerSidebarSorting.None) {
      setSorting(ExplorerSidebarSorting.Asc);
    }

    if (sorting === ExplorerSidebarSorting.Asc) {
      setSorting(ExplorerSidebarSorting.Desc);
    }

    if (sorting === ExplorerSidebarSorting.Desc) {
      setSorting(ExplorerSidebarSorting.None);
    }
  }, [sorting]);

  return (
    <div className={styles.docs}>
      <div className={styles.title}>
        Query builder
        {!!props.schema && (
          <NewButton
            variant={ButtonVariant.Link}
            onClick={(e) => {
              e.stopPropagation();
              props.onShowSchemaDrawer?.();
            }}
          >
            Schema
            <Icon icon={<IconCode />} size={16} />
          </NewButton>
        )}
      </div>
      <div className={styles.divider} />
      <TextInput
        ref={inputRef}
        defaultValue={props.url}
        placeholder="Enter GraphQL endpoint"
        onChange={(value) => {
          props.onUrlChange?.(value);
        }}
      />
      {objectType ? (
        <div className={styles.header}>
          <div className={styles.pathPart} onClick={() => setDocsPath(null)}>
            <div className={styles.pathPartName}>Root</div>
            <div className={styles.pathPartSeparator}>
              <Icon icon={<ArrowRight />} size={10} />
            </div>
          </div>
          {docsPathParts.length > 3 ? (
            <>
              <Menu
                onSelect={(value) =>
                  setDocsPath(
                    docsPathParts
                      .slice(0, docsPathParts.indexOf(value as string) + 1)
                      .join(".")
                  )
                }
                target={
                  <div
                    tabIndex={0}
                    className={classNames(styles.pathPart, styles.rest)}
                  >
                    <div className={styles.pathPartName}>...</div>
                    <div className={styles.pathPartSeparator}>
                      <Icon icon={<ArrowRight />} size={10} />
                    </div>
                  </div>
                }
              >
                {docsPathParts
                  .slice(0, docsPathParts.length - 2)
                  .map((pathPart) => {
                    return (
                      <MenuOption key={pathPart} value={pathPart}>
                        {pathPart}
                      </MenuOption>
                    );
                  })}
              </Menu>
              <div
                className={styles.pathPart}
                onClick={() => {
                  setDocsPath(
                    docsPathParts.slice(0, docsPathParts.length - 2).join(".")
                  );
                }}
              >
                <div className={styles.pathPartName}>
                  {docsPathParts[docsPathParts.length - 2]}
                </div>
                <div className={styles.pathPartSeparator}>
                  <Icon icon={<ArrowRight />} size={10} />
                </div>
              </div>
              <div
                className={styles.pathPart}
                onClick={() => {
                  setDocsPath(
                    docsPathParts.slice(0, docsPathParts.length - 1).join(".")
                  );
                }}
              >
                <div className={styles.pathPartName}>
                  {docsPathParts[docsPathParts.length - 1]}
                </div>
                <div className={styles.pathPartSeparator}>
                  <Icon icon={<ArrowRight />} size={10} />
                </div>
              </div>
            </>
          ) : (
            docsPathParts.map((pathPart, index, array) => {
              const path = array.slice(0, index + 1).join(".");

              return (
                <div
                  className={styles.pathPart}
                  onClick={() => {
                    if (path) {
                      setDocsPath(path);
                    }
                  }}
                >
                  <div className={styles.pathPartName}>{pathPart}</div>
                  <div className={styles.pathPartSeparator}>
                    <Icon icon={<ArrowRight />} size={10} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}
      {!!args.length && <div className={styles.subtitle}>Arguments</div>}
      {!!args.length && (
        <div className={styles.list}>
          {args.map((arg) => {
            const fieldName = arg.name;
            const fieldType = getObjectTypeFieldTypeName(arg.type) || "";
            const isFieldInQueryResult = isArgInQuery(
              props.tab?.query as string,
              docsPath as string,
              fieldName
            );

            return (
              <div className={classNames(styles.field)}>
                <Checkbox
                  key={`${fieldName}:${
                    isFieldInQueryResult ? "true" : "false"
                  }`}
                  defaultValue={isFieldInQueryResult}
                  placeholder={<Icon icon={<Add />} size={16} />}
                  onChange={(value) => {
                    if (value) {
                      const result = addArgToField(
                        props.tab?.query as string,
                        docsPath as string,
                        fieldName,
                        clientSchema!
                      );

                      props.onTabUpdate?.((prev) => {
                        let variables = prev.variables
                          ? JSON.parse(prev.variables)
                          : {};

                        if (result.variables) {
                          for (let arg of result.variables) {
                            variables[arg.name] = inputTypeToJsonMock(
                              typeStringToIntrospectionTypeRef(arg.type)
                            );
                          }
                        }

                        return {
                          ...prev,
                          query: result.query,
                          variables: JSON.stringify(variables, null, 2),
                        };
                      });
                    } else {
                      props.onTabUpdate?.((prev) => ({
                        ...prev,
                        query: removeArgFromField(
                          props.tab?.query as string,
                          docsPath as string,
                          fieldName
                        ).query,
                      }));
                    }
                  }}
                />
                <div
                  className={classNames(styles.info)}
                  // onClick={() => isActive && pushDocsPath(fieldName)}
                >
                  <div className={styles.name}>
                    {renderStringWithSearch(fieldName, searchValue)}
                  </div>
                  <div className={styles.type}>{fieldType}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!!objectType && !!objectType.fields?.length && (
        <>
          <div className={styles.subtitle}>
            Fields
            <Tooltip
              text={ExplorerSidebarSortingNextLabel[sorting]}
              popupStyle={{ padding: "var(--gutter-extra-small)" }}
              position={TooltipPosition.Top}
            >
              <NewButton
                size={ButtonSize.Small}
                icon
                onClick={updateSorting}
                disabled={!docsPath}
              >
                <Icon icon={<IconSortingArrows />} size={16} />
              </NewButton>
            </Tooltip>
            <div className={styles.actions}>
              <div className={styles.mainContainer}>
                {areAllTypeFieldsInQuery(
                  props.tab?.query as string,
                  docsPath as string,
                  clientSchema!,
                  props.selectedOperationName
                ) ? (
                  <NewButton
                    className={styles.main}
                    onClick={() => {
                      props.onTabUpdate?.((prev) => {
                        return {
                          ...prev,
                          query: removeTypeFieldsFromQuery(
                            props.tab?.query as string,
                            docsPath as string,
                            clientSchema!,
                            props.selectedOperationName
                          ),
                        };
                      });
                    }}
                    icon
                    size={ButtonSize.Small}
                    disabled={!docsPath}
                  >
                    <Icon icon={<IconCheckCircle />} size={16} />
                  </NewButton>
                ) : (
                  <Tooltip
                    renderContent={() => (
                      <span style={{ wordBreak: "normal" }}>
                        Click to add all fields (⌘ + Click to add all fields
                        recursively)
                      </span>
                    )}
                    position={TooltipPosition.Top}
                    popupStyle={{ padding: "var(--gutter-extra-small)" }}
                  >
                    <NewButton
                      className={styles.main}
                      onClick={(e) => {
                        let result: {
                          query: string;
                          variables?: { name: string; type: string }[];
                        } | null = null;

                        if (e.metaKey) {
                          result = addAllTypeFieldsToQueryRecursively(
                            props.tab?.query as string,
                            docsPath as string,
                            clientSchema!,
                            props.selectedOperationName
                          );
                        } else {
                          result = addAllTypeFieldsToQuery(
                            props.tab?.query as string,
                            docsPath as string,
                            clientSchema!,
                            props.selectedOperationName
                          );
                        }

                        if (result) {
                          props.onTabUpdate?.((prev) => {
                            let variables = prev.variables
                              ? JSON.parse(prev.variables)
                              : {};

                            if (result!.variables) {
                              for (let arg of result!.variables) {
                                variables[arg.name] = inputTypeToJsonMock(
                                  typeStringToIntrospectionTypeRef(arg.type)
                                );
                              }
                            }

                            return {
                              ...prev,
                              query: result!.query,
                              variables: JSON.stringify(variables, null, 2),
                            };
                          });
                        }
                      }}
                      icon
                      size={ButtonSize.Small}
                      disabled={!docsPath}
                    >
                      <Icon icon={<AddCircle />} size={16} />
                    </NewButton>
                  </Tooltip>
                )}
              </div>
              <Menu
                className={styles.moreContainer}
                target={
                  <NewButton
                    className={styles.more}
                    icon
                    size={ButtonSize.Small}
                    disabled={!docsPath}
                  >
                    <Icon icon={<More />} size={16} />
                  </NewButton>
                }
                placement="left"
                minWidth={125}
                onSelect={(value: any) => {
                  let result: {
                    query: string;
                    variables?: { name: string; type: string }[];
                  } | null = null;

                  if (value === "scalars") {
                    result = addAllScalarTypeFieldsToQuery(
                      props.tab?.query as string,
                      docsPath as string,
                      clientSchema!,
                      props.selectedOperationName
                    );
                  }

                  if (value === "recursively") {
                    result = addAllTypeFieldsToQueryRecursively(
                      props.tab?.query as string,
                      docsPath as string,
                      clientSchema!,
                      props.selectedOperationName
                    );
                  }

                  if (result) {
                    props.onTabUpdate?.((prev) => {
                      let variables = prev.variables
                        ? JSON.parse(prev.variables)
                        : {};

                      if (result!.variables) {
                        for (let arg of result!.variables) {
                          variables[arg.name] = inputTypeToJsonMock(
                            typeStringToIntrospectionTypeRef(arg.type)
                          );
                        }
                      }

                      return {
                        ...prev,
                        query: result!.query,
                        variables: JSON.stringify(variables, null, 2),
                      };
                    });
                  }
                }}
              >
                <MenuOption className={styles.option} value="scalars">
                  Select all scalar fields
                </MenuOption>
                <MenuOption className={styles.option} value="recursively">
                  Select all fields recursively (up to 6 levels)
                </MenuOption>
              </Menu>
            </div>
          </div>
          <TextInput
            ref={searchInputRef}
            className={styles.search}
            prefix={<Icon icon={<IconSearch />} size={16} />}
            placeholder="Filter"
            onChange={setSearchValue}
            clearBtn
          />
        </>
      )}
      {!!objectType ? (
        fieldsToRender.length ? (
          <div className={styles.list}>
            {fieldsToRender
              .filter((field) => {
                if (!searchValue) {
                  return true;
                }

                return new RegExp(escapeRegExp(searchValue.toLowerCase())).test(
                  field.name.toLowerCase()
                );
              })
              .sort((a, b) => {
                if (sorting === ExplorerSidebarSorting.Asc) {
                  return a.name.localeCompare(b.name);
                }

                if (sorting === ExplorerSidebarSorting.Desc) {
                  return b.name.localeCompare(a.name);
                }

                return 0;
              })
              .map((field) => {
                let fieldPath = docsPath
                  ? `${docsPath}.${field.name}`
                  : field.name;

                let isFieldInQueryResult = isFieldInQuery(
                  props.tab?.query as string,
                  fieldPath
                );
                let fieldType: string;
                let fieldName = field.name;

                if (
                  field.name ===
                  (props.schema?.__schema.queryType?.name ?? "Query")
                ) {
                  fieldType = props.schema?.__schema.queryType?.name ?? "Query";
                  fieldName = "query";

                  isFieldInQueryResult = isFieldInQuery(
                    props.tab?.query as string,
                    fieldName
                  );
                  fieldPath = fieldName;
                } else if (
                  field.name ===
                  (props.schema?.__schema.mutationType?.name ?? "Mutation")
                ) {
                  fieldType =
                    props.schema?.__schema.mutationType?.name ?? "Mutation";
                  fieldName = "mutation";

                  isFieldInQueryResult = isFieldInQuery(
                    props.tab?.query as string,
                    fieldName
                  );
                  fieldPath = fieldName;
                } else if (
                  field.name ===
                  (props.schema?.__schema.subscriptionType?.name ??
                    "Subscription")
                ) {
                  fieldType =
                    props.schema?.__schema.subscriptionType?.name ??
                    "Subscription";
                  fieldName = "subscription";

                  isFieldInQueryResult = isFieldInQuery(
                    props.tab?.query as string,
                    fieldName
                  );
                  fieldPath = fieldName;
                } else {
                  fieldType = getObjectTypeFieldTypeName(field.type) || "";
                }

                // const isActive =
                //   getObjectTypeFieldKind(field.type) === "OBJECT" ||
                //   fieldType ===
                //     (props.schema?.__schema.queryType?.name ?? "Query") ||
                //   fieldType ===
                //     (props.schema?.__schema.mutationType?.name ?? "Mutation") ||
                //   fieldType ===
                //     (props.schema?.__schema.subscriptionType?.name ??
                //       "Subscription");
                const isActive = true;

                return (
                  <div className={classNames(styles.field)}>
                    <Checkbox
                      key={`${fieldName}:${
                        isFieldInQueryResult ? "true" : "false"
                      }`}
                      defaultValue={isFieldInQueryResult}
                      placeholder={<Icon icon={<Add />} size={16} />}
                      onChange={(value) => {
                        if (value) {
                          const result = addFieldToQuery(
                            props.tab?.query as string,
                            fieldPath,
                            clientSchema!
                          );

                          props.onTabUpdate?.((prev) => {
                            let variables = prev.variables
                              ? JSON.parse(prev.variables)
                              : {};

                            if (result.variables) {
                              for (let arg of result.variables) {
                                variables[arg.name] = inputTypeToJsonMock(
                                  typeStringToIntrospectionTypeRef(arg.type)
                                );
                              }
                            }

                            return {
                              ...prev,
                              query: result.query,
                              variables: JSON.stringify(variables, null, 2),
                            };
                          });

                          if (isActive) {
                            pushDocsPath(fieldName);
                          }
                        } else if (ast) {
                          props.onTabUpdate?.((prev) => ({
                            ...prev,
                            query: removeFieldFromQuery(
                              props.tab?.query as string,
                              fieldPath
                            ).query,
                          }));
                        }
                      }}
                    />
                    <div
                      className={classNames(
                        styles.info,
                        isActive && styles.active
                      )}
                      onClick={() => isActive && pushDocsPath(fieldName)}
                    >
                      <div className={styles.name}>
                        {renderStringWithSearch(fieldName, searchValue)}
                      </div>
                      <div className={styles.type}>{fieldType}</div>
                      {isActive && (
                        <Icon
                          className={styles.arrow}
                          icon={<ArrowRight />}
                          size={12}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : searchValue ? (
          <div className={styles.empty}>No results for "{searchValue}"</div>
        ) : null
      ) : !props.introspectionLoading ? (
        <div className={styles.error}>
          <img
            height={90}
            src={
              props.theme === "dark"
                ? "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI3IiBoZWlnaHQ9IjEwNyIgdmlld0JveD0iMCAwIDEyNyAxMDciIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjYyLjk5ODciIGN5PSI1My40OTg3IiByPSI1My4xNjI4IiBmaWxsPSIjMUYxRjFGIi8+CjxyZWN0IHg9Ii0wLjUiIHk9IjgyLjI5MyIgd2lkdGg9IjEyNyIgaGVpZ2h0PSIxLjQ3Njc0IiByeD0iMC43MzgzNzIiIGZpbGw9IiMzMTM4NTAiLz4KPHBhdGggZD0iTTQxLjE3MTkgNDkuOTY4OEw2My4yMjA1IDU1LjI2MDRWODIuMTU5N0g0NS4yNTc0QzQzLjA1MyA4Mi4xNTk3IDQxLjI2NDEgODAuMzc2MiA0MS4yNTc0IDc4LjE3MTlMNDEuMTcxOSA0OS45Njg4WiIgZmlsbD0iIzA1NUZGQyIvPgo8cGF0aCBkPSJNODYuODMyIDQ5Ljk2ODhMNjMuMjE4NSA1NS4yNjA0VjgyLjE1OTdIODIuODMyQzg1LjA0MTIgODIuMTU5NyA4Ni44MzIgODAuMzY4OCA4Ni44MzIgNzguMTU5N1Y0OS45Njg4WiIgZmlsbD0iIzM3N0ZGRCIvPgo8cGF0aCBkPSJNNDEuMTcxOSA1MC4wNTNMNjMuMzE2NSA0Ni44ODI4TDg3LjAzMyA1MC4xNTQyTDYzLjIyMDUgNTUuMjYxM0w0MS4xNzE5IDUwLjA1M1oiIGZpbGw9IiMzMzMzMzMiLz4KPHBhdGggZD0iTTQxLjE3MzYgNDkuOTY4OEw2My4yMjIyIDU1LjI2MDRMNjAuMzY1NiA2MC41NDUyQzU5LjQ2MTcgNjIuMjE3MyA1Ny41MDU5IDYzLjAyMjUgNTUuNjg2NyA2Mi40NzEyTDQxLjk0MTQgNTguMzA2QzM5LjQzNDIgNTcuNTQ2MiAzOC4zMjIgNTQuNjIxMyAzOS42OTExIDUyLjM4NzZMNDEuMTczNiA0OS45Njg4WiIgZmlsbD0iIzg0QUNGMyIvPgo8cGF0aCBkPSJNODYuODM3NSA1MC4wNzAzTDYzLjIyNCA1NS4yNjM1TDY2LjQ3MDkgNjAuNTc2N0M2Ny40MTY1IDYyLjEyNCA2OS4yODQ2IDYyLjg0MTYgNzEuMDIyOSA2Mi4zMjUzTDg1LjYzMDQgNTcuOTg2NEM4OC4wNjE5IDU3LjI2NDIgODkuMjE1OCA1NC40OTAzIDg4LjAxMzkgNTIuMjU2Nkw4Ni44Mzc1IDUwLjA3MDNaIiBmaWxsPSIjODRBQ0YzIi8+CjxwYXRoIGQ9Ik02Ny41NzQyIDQ0LjYxOTJDNjguMzI4MyA0NC4yMjcgNjkuMTg3NyA0NC4wODUzIDcwLjAyNzggNDQuMjE0NUw4Ni4zMDUyIDQ2LjcxODhDODcuOTY4NCA0Ni45NzQ2IDg4LjMxOTggNDkuMjE2MiA4Ni44MTQ3IDQ5Ljk2ODhMNjMuMjIyNyA0Ni44ODE5TDY3LjU3NDIgNDQuNjE5MloiIGZpbGw9IiMzNzdGRkQiLz4KPHBhdGggZD0iTTU5LjkyMDIgNDQuMzE1MUM1OS40OTQyIDQzLjk4MzggNTguOTUyNCA0My44Mzg3IDU4LjQxNzggNDMuOTEyOEw0MS44NTQzIDQ2LjIwODdDNDAuMDc3MyA0Ni40NTUgMzkuNDk4MiA0OC43MzU3IDQwLjk0MjUgNDkuNzk5OUw0MS4xNzQgNDkuOTcwNUw2My4yMjI3IDQ2Ljg4MzdMNTkuOTIwMiA0NC4zMTUxWiIgZmlsbD0iIzM3N0ZGRCIvPgo8cGF0aCBkPSJNNzkuMDk3NyA3Ni4wNjI1Qzc5LjA5NzcgNzUuMDIyMyA3OS44OTUgNzQuMTU1OCA4MC45MzE2IDc0LjA2OTRMODIuMjIzMiA3My45NjE4QzgzLjM4OTMgNzMuODY0NiA4NC4zODkzIDc0Ljc4NDggODQuMzg5MyA3NS45NTQ4Vjc2Ljc5MTdDODQuMzg5MyA3Ny44MzE5IDgzLjU5MiA3OC42OTg0IDgyLjU1NTQgNzguNzg0OEw4MS4yNjM3IDc4Ljg5MjRDODAuMDk3NyA3OC45ODk2IDc5LjA5NzcgNzguMDY5NCA3OS4wOTc3IDc2Ljg5OTNWNzYuMDYyNVoiIGZpbGw9IiM3NTdDOTYiLz4KPHBhdGggZD0iTTYzLjQ0MSA1NS40ODIyQzYzLjQ0MSA1NS42MDQgNjMuMzQyMyA1NS43MDI3IDYzLjIyMDUgNTUuNzAyN0M2My4wOTg3IDU1LjcwMjcgNjMgNTUuNjA0IDYzIDU1LjQ4MjJDNjMgNTUuMzYwNCA2My4wOTg3IDU1LjI2MTcgNjMuMjIwNSA1NS4yNjE3QzYzLjM0MjMgNTUuMjYxNyA2My40NDEgNTUuMzYwNCA2My40NDEgNTUuNDgyMloiIGZpbGw9IiMwNTVGRkMiLz4KPHBhdGggZD0iTTYzLjIyMjcgNTUuMjYxN0w2NC43NjYxIDU3LjkwNzZWNTguMzQ4NUg2My4yMjI3VjU1LjI2MTdaIiBmaWxsPSIjMzc3RkZEIi8+CjxwYXRoIGQ9Ik02My4yMjI3IDU1LjI2MTdMNTguODEyOSA2My40MTk3TDYzLjIyMjcgNTguNzg5NVY1OC4zNDg1VjU1LjI2MTdaIiBmaWxsPSIjMDU1RkZDIi8+CjxwYXRoIGQ9Ik02My4yMjI3IDU1LjI2MTNMNjUuMjA3IDU0LjgyMDNMNjYuNzUwNCA2MC45OTM5TDYzLjIyMjcgNTUuMjYxM1oiIGZpbGw9IiM4NEFDRjMiLz4KPHBhdGggZD0iTTYzLjIyMjcgNTUuMjYxM0w2MS4yMzgzIDU0LjgyMDNDNjAuOTUzNCA1NS45NTk5IDYyLjUzMjUgNTYuNTY1IDYzLjA4MjEgNTUuNTI2OEw2My4yMjI3IDU1LjI2MTNaIiBmaWxsPSIjODRBQ0YzIi8+CjxjaXJjbGUgY3g9Ijk5LjAxMjgiIGN5PSIyNy40ODkzIiByPSI2LjcxNTkxIiBmaWxsPSIjMzMzMzMzIiBzdHJva2U9IiM3NjlFRUUiLz4KPHBhdGggZD0iTTY5Ljg4NDUgMzkuMTc0M0M2OS44ODQ1IDM5Ljc3OTggNjkuNjg2OCA0MC41MDE3IDY5LjMyNzkgNDEuMzAxNkM2OC45NzEzIDQyLjA5NjEgNjguNDcwMyA0Mi45MzU1IDY3Ljg5ODQgNDMuNzY2N0M2Ni43NTQ1IDQ1LjQyOTMgNjUuMzU0OCA0Ny4wMTk2IDY0LjM0NDUgNDguMDk2NkM2My44MDkzIDQ4LjY2NzIgNjIuOTMwNyA0OC42NjcyIDYyLjM5NTUgNDguMDk2NkM2MS4zODUyIDQ3LjAxOTYgNTkuOTg1NSA0NS40MjkzIDU4Ljg0MTYgNDMuNzY2N0M1OC4yNjk3IDQyLjkzNTUgNTcuNzY4NyA0Mi4wOTYxIDU3LjQxMjEgNDEuMzAxNkM1Ny4wNTMyIDQwLjUwMTcgNTYuODU1NSAzOS43Nzk4IDU2Ljg1NTUgMzkuMTc0M0M1Ni44NTU1IDM1LjUzMDcgNTkuNzc3IDMyLjU4NTkgNjMuMzcgMzIuNTg1OUM2Ni45NjMgMzIuNTg1OSA2OS44ODQ1IDM1LjUzMDcgNjkuODg0NSAzOS4xNzQzWiIgZmlsbD0iIzM3N0ZGRCIgc3Ryb2tlPSIjMDU1RkZDIi8+CjxwYXRoIGQ9Ik02My44MTM5IDQyLjA2NzlDNjMuNzU2OSA0Mi4zODgxIDYzLjUwMDQgNDIuNjUzOSA2My4xNzUyIDQyLjY1MzlDNjIuODQ3NiA0Mi42NTM5IDYyLjU3NjYgNDIuMzg1NiA2Mi42MTM4IDQyLjA2MDFDNjIuNjMxNyA0MS45MDM5IDYyLjY1NjUgNDEuNzY0MiA2Mi42ODg0IDQxLjY0MTFDNjIuNzYwNSA0MS4zNzQ1IDYyLjg3NzIgNDEuMTMxNSA2My4wMzg1IDQwLjkxMjJDNjMuMTk5NyA0MC42OTI5IDYzLjQxNCA0MC40NDM0IDYzLjY4MTQgNDAuMTYzOUM2My44NzY2IDM5Ljk2MTggNjQuMDU0OCAzOS43NzI2IDY0LjIxNiAzOS41OTYyQzY0LjM4MTUgMzkuNDE1NiA2NC41MTUyIDM5LjIyMjEgNjQuNjE3MSAzOS4wMTU3QzY0LjcxODkgMzguODA0OSA2NC43Njk4IDM4LjU1MzQgNjQuNzY5OCAzOC4yNjA5QzY0Ljc2OTggMzcuOTY0MiA2NC43MTY4IDM3LjcwODMgNjQuNjEwNyAzNy40OTMzQzY0LjUwODggMzcuMjc4MiA2NC4zNTYxIDM3LjExMjcgNjQuMTUyNCAzNi45OTY2QzYzLjk1MjkgMzYuODgwNCA2My43MDQ3IDM2LjgyMjQgNjMuNDA3NyAzNi44MjI0QzYzLjE2MTUgMzYuODIyNCA2Mi45MjgxIDM2Ljg2NzUgNjIuNzA3NSAzNi45NTc4QzYyLjQ4NjggMzcuMDQ4MiA2Mi4zMDg2IDM3LjE4NzkgNjIuMTcyOCAzNy4zNzcxQzYyLjEzNTYgMzcuNDI3OCA2Mi4xMDM0IDM3LjQ4MjcgNjIuMDc2MSAzNy41NDJDNjEuOTQxNyAzNy44MzM5IDYxLjcwNDYgMzguMTA2MSA2MS4zODMyIDM4LjEwNjFDNjEuMDU0NiAzOC4xMDYxIDYwLjc4MDMgMzcuODMzIDYwLjg1ODIgMzcuNTEzN0M2MC45MTcyIDM3LjI3MTkgNjEuMDExNyAzNy4wNTIyIDYxLjE0MTYgMzYuODU0NkM2MS4zNzUgMzYuNTA2MyA2MS42ODkgMzYuMjM5NyA2Mi4wODM3IDM2LjA1NDdDNjIuNDc4MyAzNS44Njk4IDYyLjkxOTYgMzUuNzc3MyA2My40MDc3IDM1Ljc3NzNDNjMuOTQ2NiAzNS43NzczIDY0LjQwNDkgMzUuODc2MyA2NC43ODI2IDM2LjA3NDFDNjUuMTY0NSAzNi4yNzE5IDY1LjQ1NTEgMzYuNTU1NyA2NS42NTQ2IDM2LjkyNTZDNjUuODU0IDM3LjI5MTEgNjUuOTUzOCAzNy43MjU1IDY1Ljk1MzggMzguMjI4N0M2NS45NTM4IDM4LjYxNTcgNjUuODc1MyAzOC45NzI3IDY1LjcxODIgMzkuMjk5NUM2NS41NjU1IDM5LjYyMiA2NS4zNjgyIDM5LjkyNTIgNjUuMTI2MyA0MC4yMDkxQzY0Ljg4NDQgNDAuNDkyOSA2NC42Mjc3IDQwLjc2MzggNjQuMzU2MSA0MS4wMjE5QzY0LjEyMjcgNDEuMjQxMiA2My45NjU3IDQxLjQ4ODUgNjMuODg1IDQxLjc2MzdDNjMuODU2MiA0MS44NjIzIDYzLjgzMjQgNDEuOTYzNyA2My44MTM5IDQyLjA2NzlaTTYyLjUyOTIgNDQuNjk4OEM2Mi41MjkyIDQ0LjUwNTMgNjIuNTg4NyA0NC4zNDE5IDYyLjcwNzUgNDQuMjA4NkM2Mi44MjYzIDQ0LjA3NTMgNjIuOTk4MiA0NC4wMDg2IDYzLjIyMzEgNDQuMDA4NkM2My40NTIyIDQ0LjAwODYgNjMuNjI2MiA0NC4wNzUzIDYzLjc0NSA0NC4yMDg2QzYzLjg2MzggNDQuMzQxOSA2My45MjMyIDQ0LjUwNTMgNjMuOTIzMiA0NC42OTg4QzYzLjkyMzIgNDQuODgzOCA2My44NjM4IDQ1LjA0MjkgNjMuNzQ1IDQ1LjE3NjJDNjMuNjI2MiA0NS4zMDk1IDYzLjQ1MjIgNDUuMzc2MiA2My4yMjMxIDQ1LjM3NjJDNjIuOTk4MiA0NS4zNzYyIDYyLjgyNjMgNDUuMzA5NSA2Mi43MDc1IDQ1LjE3NjJDNjIuNTg4NyA0NS4wNDI5IDYyLjUyOTIgNDQuODgzOCA2Mi41MjkyIDQ0LjY5ODhaIiBmaWxsPSJ3aGl0ZSIvPgo8Y2lyY2xlIGN4PSI2My4zNjk0IiBjeT0iMjcuMjgzNCIgcj0iMi4zNDU5MyIgZmlsbD0iIzFGMUYxRiIgc3Ryb2tlPSIjNzY5RUVFIi8+CjxwYXRoIGQ9Ik02NS4yMTQ4IDI2LjkxNDFIOTIuNTM0NiIgc3Ryb2tlPSIjNzY5RUVFIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2UtZGFzaGFycmF5PSI0IDgiLz4KPHBhdGggZD0iTTI2LjMyMDMgNDIuNDIxMUMyNi4zMjAzIDQyLjY5NzMgMjYuNTQ0MiA0Mi45MjExIDI2LjgyMDMgNDIuOTIxMUMyNy4wOTY1IDQyLjkyMTEgMjcuMzIwMyA0Mi42OTczIDI3LjMyMDMgNDIuNDIxMUgyNi4zMjAzWk0yNy4zMjAzIDQwLjYwMDlDMjcuMzIwMyA0MC4zMjQ4IDI3LjA5NjUgNDAuMTAwOSAyNi44MjAzIDQwLjEwMDlDMjYuNTQ0MiA0MC4xMDA5IDI2LjMyMDMgNDAuMzI0OCAyNi4zMjAzIDQwLjYwMDlIMjcuMzIwM1pNMjYuMzIwMyAzMy4zMTk5QzI2LjMyMDMgMzMuNTk2IDI2LjU0NDIgMzMuODE5OSAyNi44MjAzIDMzLjgxOTlDMjcuMDk2NSAzMy44MTk5IDI3LjMyMDMgMzMuNTk2IDI3LjMyMDMgMzMuMzE5OUgyNi4zMjAzWk0yNy4zMjAzIDI5LjY3OTRDMjcuMzIwMyAyOS40MDMyIDI3LjA5NjUgMjkuMTc5NCAyNi44MjAzIDI5LjE3OTRDMjYuNTQ0MiAyOS4xNzk0IDI2LjMyMDMgMjkuNDAzMiAyNi4zMjAzIDI5LjY3OTRIMjcuMzIwM1pNMjYuMzIwMyAyMi4zOTg0QzI2LjMyMDMgMjIuNjc0NSAyNi41NDQyIDIyLjg5ODQgMjYuODIwMyAyMi44OTg0QzI3LjA5NjUgMjIuODk4NCAyNy4zMjAzIDIyLjY3NDUgMjcuMzIwMyAyMi4zOTg0SDI2LjMyMDNaTTI3LjQzODcgMTkuNjcxNkMyNy41MSAxOS40MDQ4IDI3LjM1MTYgMTkuMTMwNyAyNy4wODQ4IDE5LjA1OTRDMjYuODE4IDE4Ljk4ODEgMjYuNTQ0IDE5LjE0NjYgMjYuNDcyNiAxOS40MTM0TDI3LjQzODcgMTkuNjcxNlpNMjkuNjU1NSAxNi4yMzA1QzI5LjM4ODggMTYuMzAxOCAyOS4yMzAzIDE2LjU3NTggMjkuMzAxNiAxNi44NDI2QzI5LjM3MjkgMTcuMTA5NCAyOS42NDcgMTcuMjY3OCAyOS45MTM4IDE3LjE5NjVMMjkuNjU1NSAxNi4yMzA1Wk0zMy4yMzAyIDE3LjA3ODFDMzMuNTA2MyAxNy4wNzgxIDMzLjczMDIgMTYuODU0MyAzMy43MzAyIDE2LjU3ODFDMzMuNzMwMiAxNi4zMDIgMzMuNTA2MyAxNi4wNzgxIDMzLjIzMDIgMTYuMDc4MVYxNy4wNzgxWk00Mi44Njk3IDE2LjA3ODFDNDIuNTkzNiAxNi4wNzgxIDQyLjM2OTcgMTYuMzAyIDQyLjM2OTcgMTYuNTc4MUM0Mi4zNjk3IDE2Ljg1NDMgNDIuNTkzNiAxNy4wNzgxIDQyLjg2OTcgMTcuMDc4MVYxNi4wNzgxWk00Ny42ODk1IDE3LjA3ODFDNDcuOTY1NiAxNy4wNzgxIDQ4LjE4OTUgMTYuODU0MyA0OC4xODk1IDE2LjU3ODFDNDguMTg5NSAxNi4zMDIgNDcuOTY1NiAxNi4wNzgxIDQ3LjY4OTUgMTYuMDc4MVYxNy4wNzgxWk01Ny4zMjkgMTYuMDc4MUM1Ny4wNTI5IDE2LjA3ODEgNTYuODI5IDE2LjMwMiA1Ni44MjkgMTYuNTc4MUM1Ni44MjkgMTYuODU0MyA1Ny4wNTI5IDE3LjA3ODEgNTcuMzI5IDE3LjA3ODFWMTYuMDc4MVpNNjAuNjQ1NSAxNy4xOTY1QzYwLjkxMjIgMTcuMjY3OCA2MS4xODYzIDE3LjEwOTQgNjEuMjU3NiAxNi44NDI2QzYxLjMyODkgMTYuNTc1OCA2MS4xNzA1IDE2LjMwMTggNjAuOTAzNyAxNi4yMzA1TDYwLjY0NTUgMTcuMTk2NVpNNjQuMDg2NiAxOS40MTM0QzY0LjAxNTMgMTkuMTQ2NiA2My43NDEyIDE4Ljk4ODEgNjMuNDc0NCAxOS4wNTk0QzYzLjIwNzcgMTkuMTMwNyA2My4wNDkyIDE5LjQwNDggNjMuMTIwNSAxOS42NzE2TDY0LjA4NjYgMTkuNDEzNFpNNjMuMjM4OSAyMS4yOTg1QzYzLjIzODkgMjEuNTc0NyA2My40NjI4IDIxLjc5ODUgNjMuNzM4OSAyMS43OTg1QzY0LjAxNTEgMjEuNzk4NSA2NC4yMzg5IDIxLjU3NDcgNjQuMjM4OSAyMS4yOTg1SDYzLjIzODlaTTY0LjIzODkgMjQuMTgwMUM2NC4yMzg5IDIzLjkwMzkgNjQuMDE1MSAyMy42ODAxIDYzLjczODkgMjMuNjgwMUM2My40NjI4IDIzLjY4MDEgNjMuMjM4OSAyMy45MDM5IDYzLjIzODkgMjQuMTgwMUg2NC4yMzg5Wk0yNy4zMjAzIDQyLjQyMTFWNDAuNjAwOUgyNi4zMjAzVjQyLjQyMTFIMjcuMzIwM1pNMjcuMzIwMyAzMy4zMTk5VjI5LjY3OTRIMjYuMzIwM1YzMy4zMTk5SDI3LjMyMDNaTTI3LjMyMDMgMjIuMzk4NFYyMC41NzgxSDI2LjMyMDNWMjIuMzk4NEgyNy4zMjAzWk0yNy4zMjAzIDIwLjU3ODFDMjcuMzIwMyAyMC4yNjM5IDI3LjM2MTYgMTkuOTYwMiAyNy40Mzg3IDE5LjY3MTZMMjYuNDcyNiAxOS40MTM0QzI2LjM3MzIgMTkuNzg1NCAyNi4zMjAzIDIwLjE3NiAyNi4zMjAzIDIwLjU3ODFIMjcuMzIwM1pNMjkuOTEzOCAxNy4xOTY1QzMwLjIwMjQgMTcuMTE5NCAzMC41MDYxIDE3LjA3ODEgMzAuODIwMyAxNy4wNzgxVjE2LjA3ODFDMzAuNDE4MiAxNi4wNzgxIDMwLjAyNzYgMTYuMTMxIDI5LjY1NTUgMTYuMjMwNUwyOS45MTM4IDE3LjE5NjVaTTMwLjgyMDMgMTcuMDc4MUgzMy4yMzAyVjE2LjA3ODFIMzAuODIwM1YxNy4wNzgxWk00Mi44Njk3IDE3LjA3ODFINDcuNjg5NVYxNi4wNzgxSDQyLjg2OTdWMTcuMDc4MVpNNTcuMzI5IDE3LjA3ODFINTkuNzM4OVYxNi4wNzgxSDU3LjMyOVYxNy4wNzgxWk01OS43Mzg5IDE3LjA3ODFDNjAuMDUzMSAxNy4wNzgxIDYwLjM1NjkgMTcuMTE5NCA2MC42NDU1IDE3LjE5NjVMNjAuOTAzNyAxNi4yMzA1QzYwLjUzMTYgMTYuMTMxIDYwLjE0MTEgMTYuMDc4MSA1OS43Mzg5IDE2LjA3ODFWMTcuMDc4MVpNNjMuMTIwNSAxOS42NzE2QzYzLjE5NzYgMTkuOTYwMiA2My4yMzg5IDIwLjI2MzkgNjMuMjM4OSAyMC41NzgxSDY0LjIzODlDNjQuMjM4OSAyMC4xNzYgNjQuMTg2IDE5Ljc4NTQgNjQuMDg2NiAxOS40MTM0TDYzLjEyMDUgMTkuNjcxNlpNNjMuMjM4OSAyMC41NzgxVjIxLjI5ODVINjQuMjM4OVYyMC41NzgxSDYzLjIzODlaTTYzLjIzODkgMjQuMTgwMVYyNC45MDA1SDY0LjIzODlWMjQuMTgwMUg2My4yMzg5WiIgZmlsbD0iIzc2OUVFRSIvPgo8cGF0aCBkPSJNMTAwLjE5NSAyNS4zNzE3QzEwMC4yNDMgMjUuMjExNSAxMDAuMTI3IDI1LjA0OTEgOTkuOTM2OCAyNS4wMDlDOTkuNzQ2NCAyNC45Njg5IDk5LjU1MzUgMjUuMDY2NCA5OS41MDU5IDI1LjIyNjZMOTcuOTAyIDMwLjYyODNDOTcuODU0NCAzMC43ODg1IDk3Ljk3MDEgMzAuOTUwOSA5OC4xNjA0IDMwLjk5MUM5OC4zNTA4IDMxLjAzMTEgOTguNTQzNyAzMC45MzM2IDk4LjU5MTMgMzAuNzczNEwxMDAuMTk1IDI1LjM3MTdaIiBmaWxsPSIjRkFGQUZBIi8+CjxwYXRoIGQ9Ik05Ni44NjQ5IDI1LjgxMjVMOTQuNjA0MSAyNy43MTZDOTQuNDY1MyAyNy44MzI4IDk0LjQ2NTMgMjguMDIyMSA5NC42MDQxIDI4LjEzOUw5Ni44NjQ5IDMwLjA0MjRDOTcuMDAzNyAzMC4xNTkyIDk3LjIyODYgMzAuMTU5MiA5Ny4zNjc0IDMwLjA0MjRDOTcuNTA2MSAyOS45MjU2IDk3LjUwNjEgMjkuNzM2MiA5Ny4zNjc0IDI5LjYxOTRMOTUuMzU3NyAyNy45Mjc1TDk3LjM2NzQgMjYuMjM1NUM5Ny41MDYxIDI2LjExODcgOTcuNTA2MSAyNS45MjkzIDk3LjM2NzQgMjUuODEyNUM5Ny4yMjg2IDI1LjY5NTcgOTcuMDAzNyAyNS42OTU3IDk2Ljg2NDkgMjUuODEyNVoiIGZpbGw9IiNGQUZBRkEiLz4KPHBhdGggZD0iTTEwMS4xMzUgMjUuODEyNUwxMDMuMzk2IDI3LjcxNkMxMDMuNTM1IDI3LjgzMjggMTAzLjUzNSAyOC4wMjIxIDEwMy4zOTYgMjguMTM5TDEwMS4xMzUgMzAuMDQyNEMxMDAuOTk2IDMwLjE1OTIgMTAwLjc3MSAzMC4xNTkyIDEwMC42MzMgMzAuMDQyNEMxMDAuNDk0IDI5LjkyNTYgMTAwLjQ5NCAyOS43MzYyIDEwMC42MzMgMjkuNjE5NEwxMDIuNjQyIDI3LjkyNzVMMTAwLjYzMyAyNi4yMzU1QzEwMC40OTQgMjYuMTE4NyAxMDAuNDk0IDI1LjkyOTMgMTAwLjYzMyAyNS44MTI1QzEwMC43NzEgMjUuNjk1NyAxMDAuOTk2IDI1LjY5NTcgMTAxLjEzNSAyNS44MTI1WiIgZmlsbD0iI0ZBRkFGQSIvPgo8Y2lyY2xlIGN4PSIyNi44MjEyIiBjeT0iNDkuMDcxMiIgcj0iNi44ODM3MiIgZmlsbD0iIzMzMzMzMyIgc3Ryb2tlPSIjOEJCM0ZBIi8+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8xMzM2M18xMDc3MDIpIj4KPHBhdGggZD0iTTI2IDQ3LjI0NjFIMjUuNDY4NVY0Ni43NDYxSDI2QzI2LjQxNDIgNDYuNzQ2MSAyNi43NSA0Ny4wODE5IDI2Ljc1IDQ3LjQ5NjFWNDguNDk2MUMyNi43NSA0OC42MzQyIDI2Ljg2MTkgNDguNzQ2MSAyNyA0OC43NDYxSDI4LjUzMTVWNDkuMjQ2MUgyN0MyNi45MTIzIDQ5LjI0NjEgMjYuODI4MiA0OS4yMzExIDI2Ljc1IDQ5LjIwMzRWNTEuNDk2MUMyNi43NSA1MS42MzQyIDI2Ljg2MTkgNTEuNzQ2MSAyNyA1MS43NDYxSDI4LjUzMTVWNTIuMjQ2MUgyN0MyNi41ODU4IDUyLjI0NjEgMjYuMjUgNTEuOTEwMyAyNi4yNSA1MS40OTYxVjQ3LjQ5NjFDMjYuMjUgNDcuMzU4IDI2LjEzODEgNDcuMjQ2MSAyNiA0Ny4yNDYxWiIgZmlsbD0iI0ZBRkFGQSIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTI5LjUgNDkuNDk2MUMyOS43NzYxIDQ5LjQ5NjEgMzAgNDkuMjcyMiAzMCA0OC45OTYxQzMwIDQ4LjcyIDI5Ljc3NjEgNDguNDk2MSAyOS41IDQ4LjQ5NjFDMjkuMjIzOSA0OC40OTYxIDI5IDQ4LjcyIDI5IDQ4Ljk5NjFDMjkgNDkuMjcyMiAyOS4yMjM5IDQ5LjQ5NjEgMjkuNSA0OS40OTYxWk0yOS41IDQ5Ljk5NjFDMzAuMDUyMyA0OS45OTYxIDMwLjUgNDkuNTQ4NCAzMC41IDQ4Ljk5NjFDMzAuNSA0OC40NDM4IDMwLjA1MjMgNDcuOTk2MSAyOS41IDQ3Ljk5NjFDMjguOTQ3NyA0Ny45OTYxIDI4LjUgNDguNDQzOCAyOC41IDQ4Ljk5NjFDMjguNSA0OS41NDg0IDI4Ljk0NzcgNDkuOTk2MSAyOS41IDQ5Ljk5NjFaIiBmaWxsPSIjRkFGQUZBIi8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMjkuNSA1Mi40OTYxQzI5Ljc3NjEgNTIuNDk2MSAzMCA1Mi4yNzIyIDMwIDUxLjk5NjFDMzAgNTEuNzIgMjkuNzc2MSA1MS40OTYxIDI5LjUgNTEuNDk2MUMyOS4yMjM5IDUxLjQ5NjEgMjkgNTEuNzIgMjkgNTEuOTk2MUMyOSA1Mi4yNzIyIDI5LjIyMzkgNTIuNDk2MSAyOS41IDUyLjQ5NjFaTTI5LjUgNTIuOTk2MUMzMC4wNTIzIDUyLjk5NjEgMzAuNSA1Mi41NDg0IDMwLjUgNTEuOTk2MUMzMC41IDUxLjQ0MzggMzAuMDUyMyA1MC45OTYxIDI5LjUgNTAuOTk2MUMyOC45NDc3IDUwLjk5NjEgMjguNSA1MS40NDM4IDI4LjUgNTEuOTk2MUMyOC41IDUyLjU0ODQgMjguOTQ3NyA1Mi45OTYxIDI5LjUgNTIuOTk2MVoiIGZpbGw9IiNGQUZBRkEiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0yNC41IDQ3LjQ5NjFDMjQuNzc2MSA0Ny40OTYxIDI1IDQ3LjI3MjIgMjUgNDYuOTk2MUMyNSA0Ni43MiAyNC43NzYxIDQ2LjQ5NjEgMjQuNSA0Ni40OTYxQzI0LjIyMzkgNDYuNDk2MSAyNCA0Ni43MiAyNCA0Ni45OTYxQzI0IDQ3LjI3MjIgMjQuMjIzOSA0Ny40OTYxIDI0LjUgNDcuNDk2MVpNMjQuNSA0Ny45OTYxQzI1LjA1MjMgNDcuOTk2MSAyNS41IDQ3LjU0ODQgMjUuNSA0Ni45OTYxQzI1LjUgNDYuNDQzOCAyNS4wNTIzIDQ1Ljk5NjEgMjQuNSA0NS45OTYxQzIzLjk0NzcgNDUuOTk2MSAyMy41IDQ2LjQ0MzggMjMuNSA0Ni45OTYxQzIzLjUgNDcuNTQ4NCAyMy45NDc3IDQ3Ljk5NjEgMjQuNSA0Ny45OTYxWiIgZmlsbD0iI0ZBRkFGQSIvPgo8L2c+CjxkZWZzPgo8Y2xpcFBhdGggaWQ9ImNsaXAwXzEzMzYzXzEwNzcwMiI+CjxyZWN0IHdpZHRoPSI3LjkzNzUiIGhlaWdodD0iNy45Mzc1IiBmaWxsPSJ3aGl0ZSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjMuMTI4OSA0NS4zNzUpIi8+CjwvY2xpcFBhdGg+CjwvZGVmcz4KPC9zdmc+Cg=="
                : "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0MCIgdmlld0JveD0iMCAwIDMyMCAyNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjE2MCIgY3k9IjEyMCIgcj0iMTIwIiBmaWxsPSIjRURGM0ZCIi8+CjxyZWN0IHg9IjE2IiB5PSIxODUiIHdpZHRoPSIyODgiIGhlaWdodD0iNCIgcng9IjIiIGZpbGw9IiM4NEFDRjMiLz4KPHBhdGggZD0iTTExMC41IDExMkwxNjAuNSAxMjRWMTg1SDExNC43MDlDMTEyLjUwNSAxODUgMTEwLjcxNiAxODMuMjE3IDExMC43MDkgMTgxLjAxMkwxMTAuNSAxMTJaIiBmaWxsPSIjMDU1RkZDIi8+CjxwYXRoIGQ9Ik0yMTQuMDQ5IDExMkwxNjAuNSAxMjRWMTg1SDIxMC4wNDlDMjEyLjI1OCAxODUgMjE0LjA0OSAxODMuMjA5IDIxNC4wNDkgMTgxVjExMloiIGZpbGw9IiMzNzdGRkQiLz4KPHBhdGggZD0iTTExMC41IDExMi4xODlMMTYwLjcxOCAxMDVMMjE0LjUgMTEyLjQxOEwxNjAuNSAxMjRMMTEwLjUgMTEyLjE4OVoiIGZpbGw9IiNFREYzRkIiLz4KPHBhdGggZD0iTTExMC41IDExMkwxNjAuNSAxMjRMMTUyLjA1MyAxMzkuNjI3QzE1MS4xNDkgMTQxLjI5OSAxNDkuMTkzIDE0Mi4xMDQgMTQ3LjM3NCAxNDEuNTUzTDEwNS45NTcgMTI5LjAwMkMxMDMuNDUgMTI4LjI0MiAxMDIuMzM4IDEyNS4zMTggMTAzLjcwNyAxMjMuMDg0TDExMC41IDExMloiIGZpbGw9IiM4NEFDRjMiLz4KPHBhdGggZD0iTTIxNC4wNDkgMTEyLjIyNEwxNjAuNSAxMjRMMTY5Ljg5NiAxMzkuMzc2QzE3MC44NDIgMTQwLjkyMyAxNzIuNzEgMTQxLjY0MSAxNzQuNDQ4IDE0MS4xMjVMMjE3LjI4NyAxMjguNEMyMTkuNzE4IDEyNy42NzggMjIwLjg3MiAxMjQuOTA0IDIxOS42NyAxMjIuNjcxTDIxNC4wNDkgMTEyLjIyNFoiIGZpbGw9IiM4NEFDRjMiLz4KPHBhdGggZD0iTTE3MS44MzkgOTkuMTAzNUMxNzIuNTkzIDk4LjcxMTQgMTczLjQ1MyA5OC41Njk3IDE3NC4yOTMgOTguNjk4OUwyMTguNzg5IDEwNS41NDVDMjIwLjcxNiAxMDUuODQxIDIyMS4xMjQgMTA4LjQzOCAyMTkuMzggMTA5LjMxTDIxNCAxMTJMMTYwLjUgMTA1TDE3MS44MzkgOTkuMTAzNVoiIGZpbGw9IiMzNzdGRkQiLz4KPHBhdGggZD0iTTE1Mi4xNjYgOTguNTE4M0MxNTEuNzQgOTguMTg2OSAxNTEuMTk4IDk4LjA0MTggMTUwLjY2NCA5OC4xMTU5TDEwNS44NjkgMTA0LjMyNUMxMDQuMDkyIDEwNC41NzEgMTAzLjUxMyAxMDYuODUyIDEwNC45NTggMTA3LjkxNkwxMTAuNSAxMTJMMTYwLjUgMTA1TDE1Mi4xNjYgOTguNTE4M1oiIGZpbGw9IiMzNzdGRkQiLz4KPHBhdGggZD0iTTE5Ni41IDE2OC44NEMxOTYuNSAxNjcuOCAxOTcuMjk3IDE2Ni45MzQgMTk4LjMzNCAxNjYuODQ3TDIwNi4zMzQgMTY2LjE4MUMyMDcuNSAxNjYuMDgzIDIwOC41IDE2Ny4wMDQgMjA4LjUgMTY4LjE3NFYxNzUuMTZDMjA4LjUgMTc2LjIgMjA3LjcwMyAxNzcuMDY2IDIwNi42NjYgMTc3LjE1M0wxOTguNjY2IDE3Ny44MTlDMTk3LjUgMTc3LjkxNyAxOTYuNSAxNzYuOTk2IDE5Ni41IDE3NS44MjZWMTY4Ljg0WiIgZmlsbD0iIzA0Mjg2NiIvPgo8cGF0aCBkPSJNMTYxIDEyNC41QzE2MSAxMjQuNzc2IDE2MC43NzYgMTI1IDE2MC41IDEyNUMxNjAuMjI0IDEyNSAxNjAgMTI0Ljc3NiAxNjAgMTI0LjVDMTYwIDEyNC4yMjQgMTYwLjIyNCAxMjQgMTYwLjUgMTI0QzE2MC43NzYgMTI0IDE2MSAxMjQuMjI0IDE2MSAxMjQuNVoiIGZpbGw9IiMwNTVGRkMiLz4KPHBhdGggZD0iTTE2MC41IDEyNEwxNjQgMTMwVjEzMUgxNjAuNVYxMjRaIiBmaWxsPSIjMzc3RkZEIi8+CjxwYXRoIGQ9Ik0xNjAuNSAxMjRMMTUwLjUgMTQyLjVMMTYwLjUgMTMyVjEzMVYxMjRaIiBmaWxsPSIjMDU1RkZDIi8+CjxwYXRoIGQ9Ik0xNjAuNSAxMjRMMTY1IDEyM0wxNjguNSAxMzdMMTYwLjUgMTI0WiIgZmlsbD0iIzg0QUNGMyIvPgo8cGF0aCBkPSJNMTYwLjUgMTI0TDE1NiAxMjNMMTU1LjQ5MSAxMjUuMDM4QzE1NC45MTggMTI3LjMyOSAxNTguMDkzIDEyOC41NDYgMTU5LjE5OCAxMjYuNDU4TDE2MC41IDEyNFoiIGZpbGw9IiM4NEFDRjMiLz4KPGNpcmNsZSBjeD0iMjQyIiBjeT0iNjAiIHI9IjE1IiBmaWxsPSIjODRBQ0YzIiBzdHJva2U9IiMwNTVGRkMiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBkPSJNMTc2IDg4QzE3NiA4OS41OTA2IDE3NS40MDEgOTEuNTEwMSAxNzQuMzU2IDkzLjYxNjVDMTczLjMxOSA5NS43MDcgMTcxLjg4NSA5Ny44OTggMTcwLjMxNCAxMDAuMDA5QzE2Ny4xNzIgMTA0LjIzIDE2My41NDYgMTA4LjA0NiAxNjEuNjM0IDEwOS45NzJDMTYxLjI3NiAxMTAuMzMyIDE2MC43MjQgMTEwLjMzMiAxNjAuMzY2IDEwOS45NzJDMTU4LjQ1NCAxMDguMDQ2IDE1NC44MjggMTA0LjIzIDE1MS42ODYgMTAwLjAwOUMxNTAuMTE1IDk3Ljg5OCAxNDguNjgxIDk1LjcwNyAxNDcuNjQ0IDkzLjYxNjVDMTQ2LjU5OSA5MS41MTAxIDE0NiA4OS41OTA2IDE0NiA4OEMxNDYgNzkuNzE1NyAxNTIuNzE2IDczIDE2MSA3M0MxNjkuMjg0IDczIDE3NiA3OS43MTU3IDE3NiA4OFoiIGZpbGw9IiMzNzdGRkQiIHN0cm9rZT0iIzA1NUZGQyIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Ik0xNjEuOTc4IDkzLjc2MzRDMTYxLjkwOCA5NC4zMTExIDE2MS40NjkgOTQuNzYwOCAxNjAuOTE2IDk0Ljc2MDhIMTYwLjE3OEMxNTkuNjIyIDk0Ljc2MDggMTU5LjE2NiA5NC4zMDU5IDE1OS4yMTEgOTMuNzUxNEMxNTkuMjUyIDkzLjI0ODIgMTU5LjMyMSA5Mi44MTEgMTU5LjQxOSA5Mi40Mzk1QzE1OS41ODYgOTEuODI4NCAxNTkuODU3IDkxLjI3MTUgMTYwLjIzMiA5MC43Njg4QzE2MC42MDYgOTAuMjY2MSAxNjEuMTAzIDg5LjY5NDQgMTYxLjcyNCA4OS4wNTM4QzE2Mi4xNzcgODguNTkwNSAxNjIuNTkxIDg4LjE1NjggMTYyLjk2NiA4Ny43NTI3QzE2My4zNSA4Ny4zMzg3IDE2My42NiA4Ni44OTUyIDE2My44OTcgODYuNDIyQzE2NC4xMzMgODUuOTM5MSAxNjQuMjUxIDg1LjM2MjUgMTY0LjI1MSA4NC42OTIyQzE2NC4yNTEgODQuMDEyMSAxNjQuMTI4IDgzLjQyNTYgMTYzLjg4MiA4Mi45MzI4QzE2My42NDUgODIuNDQgMTYzLjI5MSA4Mi4wNjA1IDE2Mi44MTggODEuNzk0NEMxNjIuMzU1IDgxLjUyODIgMTYxLjc3OCA4MS4zOTUyIDE2MS4wODkgODEuMzk1MkMxNjAuNTE3IDgxLjM5NTIgMTU5Ljk3NSA4MS40OTg3IDE1OS40NjMgODEuNzA1NkMxNTguOTUxIDgxLjkxMjYgMTU4LjUzNyA4Mi4yMzMgMTU4LjIyMiA4Mi42NjY3QzE1OC4wNzEgODIuODY5MSAxNTcuOTU1IDgzLjEwMTggMTU3Ljg3NCA4My4zNjQ5QzE1Ny43MTQgODMuODg3NCAxNTcuMjk1IDg0LjMzNzQgMTU2Ljc0OCA4NC4zMzc0SDE1Ni4wMThDMTU1LjQ1OSA4NC4zMzc0IDE1NC45OTcgODMuODc1NSAxNTUuMDk2IDgzLjMyNTFDMTU1LjIyIDgyLjYzMjkgMTU1LjQ2NCA4Mi4wMTQyIDE1NS44MjggODEuNDY5MUMxNTYuMzY5IDgwLjY3MDcgMTU3LjA5OSA4MC4wNTk2IDE1OC4wMTUgNzkuNjM1OEMxNTguOTMxIDc5LjIxMTkgMTU5Ljk1NiA3OSAxNjEuMDg5IDc5QzE2Mi4zNCA3OSAxNjMuNDA0IDc5LjIyNjcgMTY0LjI4MSA3OS42ODAxQzE2NS4xNjcgODAuMTMzNSAxNjUuODQyIDgwLjc4NDEgMTY2LjMwNSA4MS42MzE3QzE2Ni43NjggODIuNDY5NSAxNjcgODMuNDY1MSAxNjcgODQuNjE4M0MxNjcgODUuNTA1NCAxNjYuODE4IDg2LjMyMzUgMTY2LjQ1MyA4Ny4wNzI2QzE2Ni4wOTkgODcuODExOCAxNjUuNjQgODguNTA2NyAxNjUuMDc5IDg5LjE1NzNDMTY0LjUxNyA4OS44MDc4IDE2My45MjEgOTAuNDI4OCAxNjMuMjkxIDkxLjAyMDJDMTYyLjc0OSA5MS41MjI5IDE2Mi4zODQgOTIuMDg5NiAxNjIuMTk3IDkyLjcyMDRDMTYyLjA5OCA5My4wNTQzIDE2Mi4wMjUgOTMuNDAxOSAxNjEuOTc4IDkzLjc2MzRaTTE1OS4wNDkgOTkuNDQ3NkMxNTkuMDQ5IDk5LjAwNCAxNTkuMTg3IDk4LjYyOTUgMTU5LjQ2MyA5OC4zMjM5QzE1OS43MzkgOTguMDE4NCAxNjAuMTM4IDk3Ljg2NTYgMTYwLjY2IDk3Ljg2NTZDMTYxLjE5MiA5Ny44NjU2IDE2MS41OTYgOTguMDE4NCAxNjEuODcyIDk4LjMyMzlDMTYyLjE0OCA5OC42Mjk1IDE2Mi4yODYgOTkuMDA0IDE2Mi4yODYgOTkuNDQ3NkMxNjIuMjg2IDk5Ljg3MTQgMTYyLjE0OCAxMDAuMjM2IDE2MS44NzIgMTAwLjU0MkMxNjEuNTk2IDEwMC44NDcgMTYxLjE5MiAxMDEgMTYwLjY2IDEwMUMxNjAuMTM4IDEwMSAxNTkuNzM5IDEwMC44NDcgMTU5LjQ2MyAxMDAuNTQyQzE1OS4xODcgMTAwLjIzNiAxNTkuMDQ5IDk5Ljg3MTQgMTU5LjA0OSA5OS40NDc2WiIgZmlsbD0id2hpdGUiLz4KPGNpcmNsZSBjeD0iMTYxIiBjeT0iNjAiIHI9IjUiIGZpbGw9IndoaXRlIiBzdHJva2U9IiMwNTVGRkMiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBkPSJNMTY3LjU1IDYxQzE2OC4xMDIgNjEgMTY4LjU1IDYwLjU1MjMgMTY4LjU1IDYwQzE2OC41NSA1OS40NDc3IDE2OC4xMDIgNTkgMTY3LjU1IDU5VjYxWk0xNzUuNzUgNTlDMTc1LjE5OCA1OSAxNzQuNzUgNTkuNDQ3NyAxNzQuNzUgNjBDMTc0Ljc1IDYwLjU1MjMgMTc1LjE5OCA2MSAxNzUuNzUgNjFWNTlaTTE3OS44NSA2MUMxODAuNDAyIDYxIDE4MC44NSA2MC41NTIzIDE4MC44NSA2MEMxODAuODUgNTkuNDQ3NyAxODAuNDAyIDU5IDE3OS44NSA1OVY2MVpNMTg4LjA1IDU5QzE4Ny40OTggNTkgMTg3LjA1IDU5LjQ0NzcgMTg3LjA1IDYwQzE4Ny4wNSA2MC41NTIzIDE4Ny40OTggNjEgMTg4LjA1IDYxVjU5Wk0xOTIuMTUgNjFDMTkyLjcwMiA2MSAxOTMuMTUgNjAuNTUyMyAxOTMuMTUgNjBDMTkzLjE1IDU5LjQ0NzcgMTkyLjcwMiA1OSAxOTIuMTUgNTlWNjFaTTIwMC4zNSA1OUMxOTkuNzk4IDU5IDE5OS4zNSA1OS40NDc3IDE5OS4zNSA2MEMxOTkuMzUgNjAuNTUyMyAxOTkuNzk4IDYxIDIwMC4zNSA2MVY1OVpNMjA0LjQ1IDYxQzIwNS4wMDIgNjEgMjA1LjQ1IDYwLjU1MjMgMjA1LjQ1IDYwQzIwNS40NSA1OS40NDc3IDIwNS4wMDIgNTkgMjA0LjQ1IDU5VjYxWk0yMTIuNjUgNTlDMjEyLjA5OCA1OSAyMTEuNjUgNTkuNDQ3NyAyMTEuNjUgNjBDMjExLjY1IDYwLjU1MjMgMjEyLjA5OCA2MSAyMTIuNjUgNjFWNTlaTTIxNi43NSA2MUMyMTcuMzAyIDYxIDIxNy43NSA2MC41NTIzIDIxNy43NSA2MEMyMTcuNzUgNTkuNDQ3NyAyMTcuMzAyIDU5IDIxNi43NSA1OVY2MVpNMjI0Ljk1IDU5QzIyNC4zOTggNTkgMjIzLjk1IDU5LjQ0NzcgMjIzLjk1IDYwQzIyMy45NSA2MC41NTIzIDIyNC4zOTggNjEgMjI0Ljk1IDYxVjU5Wk0xNjUuNSA2MUgxNjcuNTVWNTlIMTY1LjVWNjFaTTE3NS43NSA2MUgxNzkuODVWNTlIMTc1Ljc1VjYxWk0xODguMDUgNjFIMTkyLjE1VjU5SDE4OC4wNVY2MVpNMjAwLjM1IDYxSDIwNC40NVY1OUgyMDAuMzVWNjFaTTIxMi42NSA2MUgyMTYuNzVWNTlIMjEyLjY1VjYxWk0yMjQuOTUgNjFIMjI3VjU5SDIyNC45NVY2MVoiIGZpbGw9IiMwNTVGRkMiLz4KPHBhdGggZD0iTTc3IDk1Qzc3IDk1LjU1MjMgNzcuNDQ3NyA5NiA3OCA5NkM3OC41NTIzIDk2IDc5IDk1LjU1MjMgNzkgOTVINzdaTTc5IDkzLjE2NjdDNzkgOTIuNjE0NCA3OC41NTIzIDkyLjE2NjcgNzggOTIuMTY2N0M3Ny40NDc3IDkyLjE2NjcgNzcgOTIuNjE0NCA3NyA5My4xNjY3SDc5Wk03NyA4NS44MzMzQzc3IDg2LjM4NTYgNzcuNDQ3NyA4Ni44MzMzIDc4IDg2LjgzMzNDNzguNTUyMyA4Ni44MzMzIDc5IDg2LjM4NTYgNzkgODUuODMzM0g3N1pNNzkgODIuMTY2N0M3OSA4MS42MTQ0IDc4LjU1MjMgODEuMTY2NyA3OCA4MS4xNjY3Qzc3LjQ0NzcgODEuMTY2NyA3NyA4MS42MTQ0IDc3IDgyLjE2NjdINzlaTTc3IDc0LjgzMzNDNzcgNzUuMzg1NiA3Ny40NDc3IDc1LjgzMzMgNzggNzUuODMzM0M3OC41NTIzIDc1LjgzMzMgNzkgNzUuMzg1NiA3OSA3NC44MzMzSDc3Wk03OSA3MS4xNjY3Qzc5IDcwLjYxNDQgNzguNTUyMyA3MC4xNjY3IDc4IDcwLjE2NjdDNzcuNDQ3NyA3MC4xNjY3IDc3IDcwLjYxNDQgNzcgNzEuMTY2N0g3OVpNNzcgNjMuODMzM0M3NyA2NC4zODU2IDc3LjQ0NzcgNjQuODMzMyA3OCA2NC44MzMzQzc4LjU1MjMgNjQuODMzMyA3OSA2NC4zODU2IDc5IDYzLjgzMzNINzdaTTc5IDYwLjE2NjdDNzkgNTkuNjE0NCA3OC41NTIzIDU5LjE2NjcgNzggNTkuMTY2N0M3Ny40NDc3IDU5LjE2NjcgNzcgNTkuNjE0NCA3NyA2MC4xNjY3SDc5Wk03NyA1Mi44MzMzQzc3IDUzLjM4NTYgNzcuNDQ3NyA1My44MzMzIDc4IDUzLjgzMzNDNzguNTUyMyA1My44MzMzIDc5IDUzLjM4NTYgNzkgNTIuODMzM0g3N1pNNzkgNDkuMTY2N0M3OSA0OC42MTQ0IDc4LjU1MjMgNDguMTY2NyA3OCA0OC4xNjY3Qzc3LjQ0NzcgNDguMTY2NyA3NyA0OC42MTQ0IDc3IDQ5LjE2NjdINzlaTTc3IDQxLjgzMzNDNzcgNDIuMzg1NiA3Ny40NDc3IDQyLjgzMzMgNzggNDIuODMzM0M3OC41NTIzIDQyLjgzMzMgNzkgNDIuMzg1NiA3OSA0MS44MzMzSDc3Wk03OS4xMDE1IDM5LjIyMjZDNzkuMjQ0MSAzOC42ODkgNzguOTI3MiAzOC4xNDA5IDc4LjM5MzYgMzcuOTk4M0M3Ny44NjAxIDM3Ljg1NTYgNzcuMzExOSAzOC4xNzI2IDc3LjE2OTMgMzguNzA2MUw3OS4xMDE1IDM5LjIyMjZaTTgwLjcwNjEgMzUuMTY5M0M4MC4xNzI2IDM1LjMxMTkgNzkuODU1NiAzNS44NjAxIDc5Ljk5ODMgMzYuMzkzNkM4MC4xNDA5IDM2LjkyNzIgODAuNjg5IDM3LjI0NDEgODEuMjIyNiAzNy4xMDE1TDgwLjcwNjEgMzUuMTY5M1pNODQuMDgzMyAzN0M4NC42MzU2IDM3IDg1LjA4MzMgMzYuNTUyMyA4NS4wODMzIDM2Qzg1LjA4MzMgMzUuNDQ3NyA4NC42MzU2IDM1IDg0LjA4MzMgMzVWMzdaTTkyLjQxNjcgMzVDOTEuODY0NCAzNSA5MS40MTY3IDM1LjQ0NzcgOTEuNDE2NyAzNkM5MS40MTY3IDM2LjU1MjMgOTEuODY0NCAzNyA5Mi40MTY3IDM3VjM1Wk05Ni41ODMzIDM3Qzk3LjEzNTYgMzcgOTcuNTgzMyAzNi41NTIzIDk3LjU4MzMgMzZDOTcuNTgzMyAzNS40NDc3IDk3LjEzNTYgMzUgOTYuNTgzMyAzNVYzN1pNMTA0LjkxNyAzNUMxMDQuMzY0IDM1IDEwMy45MTcgMzUuNDQ3NyAxMDMuOTE3IDM2QzEwMy45MTcgMzYuNTUyMyAxMDQuMzY0IDM3IDEwNC45MTcgMzdWMzVaTTEwOS4wODMgMzdDMTA5LjYzNiAzNyAxMTAuMDgzIDM2LjU1MjMgMTEwLjA4MyAzNkMxMTAuMDgzIDM1LjQ0NzcgMTA5LjYzNiAzNSAxMDkuMDgzIDM1VjM3Wk0xMTcuNDE3IDM1QzExNi44NjQgMzUgMTE2LjQxNyAzNS40NDc3IDExNi40MTcgMzZDMTE2LjQxNyAzNi41NTIzIDExNi44NjQgMzcgMTE3LjQxNyAzN1YzNVpNMTIxLjU4MyAzN0MxMjIuMTM2IDM3IDEyMi41ODMgMzYuNTUyMyAxMjIuNTgzIDM2QzEyMi41ODMgMzUuNDQ3NyAxMjIuMTM2IDM1IDEyMS41ODMgMzVWMzdaTTEyOS45MTcgMzVDMTI5LjM2NCAzNSAxMjguOTE3IDM1LjQ0NzcgMTI4LjkxNyAzNkMxMjguOTE3IDM2LjU1MjMgMTI5LjM2NCAzNyAxMjkuOTE3IDM3VjM1Wk0xMzQuMDgzIDM3QzEzNC42MzYgMzcgMTM1LjA4MyAzNi41NTIzIDEzNS4wODMgMzZDMTM1LjA4MyAzNS40NDc3IDEzNC42MzYgMzUgMTM0LjA4MyAzNVYzN1pNMTQyLjQxNyAzNUMxNDEuODY0IDM1IDE0MS40MTcgMzUuNDQ3NyAxNDEuNDE3IDM2QzE0MS40MTcgMzYuNTUyMyAxNDEuODY0IDM3IDE0Mi40MTcgMzdWMzVaTTE0Ni41ODMgMzdDMTQ3LjEzNiAzNyAxNDcuNTgzIDM2LjU1MjMgMTQ3LjU4MyAzNkMxNDcuNTgzIDM1LjQ0NzcgMTQ3LjEzNiAzNSAxNDYuNTgzIDM1VjM3Wk0xNTQuOTE3IDM1QzE1NC4zNjQgMzUgMTUzLjkxNyAzNS40NDc3IDE1My45MTcgMzZDMTUzLjkxNyAzNi41NTIzIDE1NC4zNjQgMzcgMTU0LjkxNyAzN1YzNVpNMTU3Ljc3NyAzNy4xMDE1QzE1OC4zMTEgMzcuMjQ0MSAxNTguODU5IDM2LjkyNzIgMTU5LjAwMiAzNi4zOTM2QzE1OS4xNDQgMzUuODYwMSAxNTguODI3IDM1LjMxMTkgMTU4LjI5NCAzNS4xNjkzTDE1Ny43NzcgMzcuMTAxNVpNMTYxLjgzMSAzOC43MDYxQzE2MS42ODggMzguMTcyNiAxNjEuMTQgMzcuODU1NiAxNjAuNjA2IDM3Ljk5ODNDMTYwLjA3MyAzOC4xNDA5IDE1OS43NTYgMzguNjg5IDE1OS44OTkgMzkuMjIyNkwxNjEuODMxIDM4LjcwNjFaTTE2MCA0Mi41QzE2MCA0My4wNTIzIDE2MC40NDggNDMuNSAxNjEgNDMuNUMxNjEuNTUyIDQzLjUgMTYyIDQzLjA1MjMgMTYyIDQyLjVIMTYwWk0xNjIgNTIuNUMxNjIgNTEuOTQ3NyAxNjEuNTUyIDUxLjUgMTYxIDUxLjVDMTYwLjQ0OCA1MS41IDE2MCA1MS45NDc3IDE2MCA1Mi41SDE2MlpNNzkgOTVWOTMuMTY2N0g3N1Y5NUg3OVpNNzkgODUuODMzM1Y4Mi4xNjY3SDc3Vjg1LjgzMzNINzlaTTc5IDc0LjgzMzNWNzEuMTY2N0g3N1Y3NC44MzMzSDc5Wk03OSA2My44MzMzVjYwLjE2NjdINzdWNjMuODMzM0g3OVpNNzkgNTIuODMzM1Y0OS4xNjY3SDc3VjUyLjgzMzNINzlaTTc5IDQxLjgzMzNWNDBINzdWNDEuODMzM0g3OVpNNzkgNDBDNzkgMzkuNzI5OCA3OS4wMzU1IDM5LjQ2OTQgNzkuMTAxNSAzOS4yMjI2TDc3LjE2OTMgMzguNzA2MUM3Ny4wNTg3IDM5LjExOTkgNzcgMzkuNTUzOSA3NyA0MEg3OVpNODEuMjIyNiAzNy4xMDE1QzgxLjQ2OTQgMzcuMDM1NSA4MS43Mjk4IDM3IDgyIDM3VjM1QzgxLjU1MzkgMzUgODEuMTE5OSAzNS4wNTg3IDgwLjcwNjEgMzUuMTY5M0w4MS4yMjI2IDM3LjEwMTVaTTgyIDM3SDg0LjA4MzNWMzVIODJWMzdaTTkyLjQxNjcgMzdIOTYuNTgzM1YzNUg5Mi40MTY3VjM3Wk0xMDQuOTE3IDM3SDEwOS4wODNWMzVIMTA0LjkxN1YzN1pNMTE3LjQxNyAzN0gxMjEuNTgzVjM1SDExNy40MTdWMzdaTTEyOS45MTcgMzdIMTM0LjA4M1YzNUgxMjkuOTE3VjM3Wk0xNDIuNDE3IDM3SDE0Ni41ODNWMzVIMTQyLjQxN1YzN1pNMTU0LjkxNyAzN0gxNTdWMzVIMTU0LjkxN1YzN1pNMTU3IDM3QzE1Ny4yNyAzNyAxNTcuNTMxIDM3LjAzNTUgMTU3Ljc3NyAzNy4xMDE1TDE1OC4yOTQgMzUuMTY5M0MxNTcuODggMzUuMDU4NyAxNTcuNDQ2IDM1IDE1NyAzNVYzN1pNMTU5Ljg5OSAzOS4yMjI2QzE1OS45NjUgMzkuNDY5NCAxNjAgMzkuNzI5OCAxNjAgNDBIMTYyQzE2MiAzOS41NTM5IDE2MS45NDEgMzkuMTE5OSAxNjEuODMxIDM4LjcwNjFMMTU5Ljg5OSAzOS4yMjI2Wk0xNjAgNDBWNDIuNUgxNjJWNDBIMTYwWk0xNjAgNTIuNVY1NUgxNjJWNTIuNUgxNjBaIiBmaWxsPSIjMDU1RkZDIi8+CjxwYXRoIGQ9Ik0yNDQuMTI1IDU0Ljc0MzRDMjQ0LjIwOSA1NC40MjI5IDI0NC4wMDQgNTQuMDk4MSAyNDMuNjY1IDU0LjAxOEMyNDMuMzI3IDUzLjkzNzkgMjQyLjk4NCA1NC4xMzI3IDI0Mi44OTkgNTQuNDUzM0wyNDAuMDQ4IDY1LjI1NjZDMjM5Ljk2MyA2NS41NzcxIDI0MC4xNjkgNjUuOTAxOSAyNDAuNTA3IDY1Ljk4MkMyNDAuODQ2IDY2LjA2MjEgMjQxLjE4OSA2NS44NjczIDI0MS4yNzMgNjUuNTQ2N0wyNDQuMTI1IDU0Ljc0MzRaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjM4LjIwNCA1NS42MjVMMjM0LjE4NSA1OS40MzE5QzIzMy45MzggNTkuNjY1NSAyMzMuOTM4IDYwLjA0NDMgMjM0LjE4NSA2MC4yNzc5TDIzOC4yMDQgNjQuMDg0OEMyMzguNDUxIDY0LjMxODQgMjM4Ljg1MSA2NC4zMTg0IDIzOS4wOTggNjQuMDg0OEMyMzkuMzQ0IDYzLjg1MTIgMjM5LjM0NCA2My40NzI1IDIzOS4wOTggNjMuMjM4OEwyMzUuNTI1IDU5Ljg1NDlMMjM5LjA5OCA1Ni40NzFDMjM5LjM0NCA1Ni4yMzc0IDIzOS4zNDQgNTUuODU4NiAyMzkuMDk4IDU1LjYyNUMyMzguODUxIDU1LjM5MTQgMjM4LjQ1MSA1NS4zOTE0IDIzOC4yMDQgNTUuNjI1WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTI0NS43OTYgNTUuNjI1TDI0OS44MTUgNTkuNDMxOUMyNTAuMDYyIDU5LjY2NTUgMjUwLjA2MiA2MC4wNDQzIDI0OS44MTUgNjAuMjc3OUwyNDUuNzk2IDY0LjA4NDhDMjQ1LjU0OSA2NC4zMTg0IDI0NS4xNDkgNjQuMzE4NCAyNDQuOTAyIDY0LjA4NDhDMjQ0LjY1NiA2My44NTEyIDI0NC42NTYgNjMuNDcyNSAyNDQuOTAyIDYzLjIzODhMMjQ4LjQ3NSA1OS44NTQ5TDI0NC45MDIgNTYuNDcxQzI0NC42NTYgNTYuMjM3NCAyNDQuNjU2IDU1Ljg1ODYgMjQ0LjkwMiA1NS42MjVDMjQ1LjE0OSA1NS4zOTE0IDI0NS41NDkgNTUuMzkxNCAyNDUuNzk2IDU1LjYyNVoiIGZpbGw9IndoaXRlIi8+CjxjaXJjbGUgY3g9Ijc4IiBjeT0iMTEwIiByPSIxNSIgZmlsbD0iI0Q4RTZGRiIgc3Ryb2tlPSIjOEJCM0ZBIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZD0iTTczIDEwN0M3My45MzE5IDEwNyA3NC43MTUgMTA2LjM2MyA3NC45MzcgMTA1LjVINzZDNzYuMjc2MSAxMDUuNSA3Ni41IDEwNS43MjQgNzYuNSAxMDZWMTE0Qzc2LjUgMTE0LjgyOCA3Ny4xNzE2IDExNS41IDc4IDExNS41SDgxLjA2M0M4MS4yODUgMTE2LjM2MyA4Mi4wNjgxIDExNyA4MyAxMTdDODQuMTA0NiAxMTcgODUgMTE2LjEwNSA4NSAxMTVDODUgMTEzLjg5NSA4NC4xMDQ2IDExMyA4MyAxMTNDODIuMDY4MSAxMTMgODEuMjg1IDExMy42MzcgODEuMDYzIDExNC41SDc4Qzc3LjcyMzkgMTE0LjUgNzcuNSAxMTQuMjc2IDc3LjUgMTE0VjEwOS40MTVDNzcuNjU2NCAxMDkuNDcgNzcuODI0NyAxMDkuNSA3OCAxMDkuNUg4MS4wNjNDODEuMjg1IDExMC4zNjMgODIuMDY4MSAxMTEgODMgMTExQzg0LjEwNDYgMTExIDg1IDExMC4xMDUgODUgMTA5Qzg1IDEwNy44OTUgODQuMTA0NiAxMDcgODMgMTA3QzgyLjA2ODEgMTA3IDgxLjI4NSAxMDcuNjM3IDgxLjA2MyAxMDguNUg3OEM3Ny43MjM5IDEwOC41IDc3LjUgMTA4LjI3NiA3Ny41IDEwOFYxMDZDNzcuNSAxMDUuMTcyIDc2LjgyODQgMTA0LjUgNzYgMTA0LjVINzQuOTM3Qzc0LjcxNSAxMDMuNjM3IDczLjkzMTkgMTAzIDczIDEwM0M3MS44OTU0IDEwMyA3MSAxMDMuODk1IDcxIDEwNUM3MSAxMDYuMTA1IDcxLjg5NTQgMTA3IDczIDEwN1oiIGZpbGw9IiMwNTVGRkMiLz4KPC9zdmc+Cg=="
            }
            alt="empty"
          />
          Please ensure that you have entered the correct endpoint URL in the
          Connection settings and verify that your GraphQL service is active and
          running.
          <br />
          <br />
          If introspection is enabled the Query Builder will promptly display
          it, allowing you to explore and interact with your schema immediately.
          Connecting your endpoint is the first step to unlocking the full
          potential of our tools.
        </div>
      ) : (
        <div className={styles.loader}>
          <Loader visible />
        </div>
      )}
    </div>
  );
}

function ExplorerSidebarHistory(props: ExplorerSidebarProps) {
  return (
    <div className={styles.history}>
      <div className={styles.title}>
        History{" "}
        <Button
          className={styles.deleteAll}
          icon={<Trash />}
          type="link"
          label="Clear all"
          onClick={props.deleteHistory}
        />
      </div>
      <div className={styles.divider} />
      <div className={styles.list}>
        {!!props.history?.length ? (
          props.history
            .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
            .filter(
              (historyItem) =>
                historyItem.serviceKey?.name === props.serviceKey?.name &&
                historyItem.serviceKey?.label === props.serviceKey?.label
            )
            .map((historyItem) => (
              <div className={styles.itemWrapper}>
                <div
                  className={styles.item}
                  onClick={() => {
                    if (props.tab?.isHistoryTab) {
                      props.onTabUpdate?.((prev) => {
                        return {
                          ...prev,
                          ...historyItem,
                        };
                      });
                    } else {
                      let tabId = guuid();

                      props.onTabCreate?.({
                        isHistoryTab: true,
                        ...props.tab,
                        ...historyItem,
                        id: tabId,
                      });

                      props.onTabActivate?.(tabId);
                    }
                  }}
                >
                  <div className={styles.header}>
                    <div className={styles.title}>
                      {historyItem.operationName || "(Empty)"}
                    </div>
                    <div className={styles.date}>
                      {moment(historyItem.createdAt).format("MM/DD/YYYY HH:mm")}
                    </div>
                    <Tooltip
                      parentClassName={styles.delete}
                      text="Delete"
                      position={TooltipPosition.Bottom}
                      popupStyle={{ padding: "var(--gutter-extra-small)" }}
                    >
                      <div
                        className={styles.button}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          props.deleteHistoryItem(historyItem);
                        }}
                      >
                        <Icon icon={<Trash />} size={16} />
                      </div>
                    </Tooltip>
                  </div>
                  <div className={styles.body}>
                    <div className={styles.query}>{historyItem.query}</div>
                  </div>
                </div>
                <div className={styles.divider} />
              </div>
            ))
        ) : (
          <div className={styles.empty}>
            <img
              height={90}
              src={
                props.theme === "dark"
                  ? "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI3IiBoZWlnaHQ9IjEwNyIgdmlld0JveD0iMCAwIDEyNyAxMDciIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjYyLjk5ODciIGN5PSI1My40OTg3IiByPSI1My4xNjI4IiBmaWxsPSIjMUYxRjFGIi8+CjxyZWN0IHg9Ii0wLjUiIHk9IjgyLjI5MyIgd2lkdGg9IjEyNyIgaGVpZ2h0PSIxLjQ3Njc0IiByeD0iMC43MzgzNzIiIGZpbGw9IiMzMTM4NTAiLz4KPHBhdGggZD0iTTQxLjE3MTkgNDkuOTY4OEw2My4yMjA1IDU1LjI2MDRWODIuMTU5N0g0NS4yNTc0QzQzLjA1MyA4Mi4xNTk3IDQxLjI2NDEgODAuMzc2MiA0MS4yNTc0IDc4LjE3MTlMNDEuMTcxOSA0OS45Njg4WiIgZmlsbD0iIzA1NUZGQyIvPgo8cGF0aCBkPSJNODYuODMyIDQ5Ljk2ODhMNjMuMjE4NSA1NS4yNjA0VjgyLjE1OTdIODIuODMyQzg1LjA0MTIgODIuMTU5NyA4Ni44MzIgODAuMzY4OCA4Ni44MzIgNzguMTU5N1Y0OS45Njg4WiIgZmlsbD0iIzM3N0ZGRCIvPgo8cGF0aCBkPSJNNDEuMTcxOSA1MC4wNTNMNjMuMzE2NSA0Ni44ODI4TDg3LjAzMyA1MC4xNTQyTDYzLjIyMDUgNTUuMjYxM0w0MS4xNzE5IDUwLjA1M1oiIGZpbGw9IiMzMzMzMzMiLz4KPHBhdGggZD0iTTQxLjE3MzYgNDkuOTY4OEw2My4yMjIyIDU1LjI2MDRMNjAuMzY1NiA2MC41NDUyQzU5LjQ2MTcgNjIuMjE3MyA1Ny41MDU5IDYzLjAyMjUgNTUuNjg2NyA2Mi40NzEyTDQxLjk0MTQgNTguMzA2QzM5LjQzNDIgNTcuNTQ2MiAzOC4zMjIgNTQuNjIxMyAzOS42OTExIDUyLjM4NzZMNDEuMTczNiA0OS45Njg4WiIgZmlsbD0iIzg0QUNGMyIvPgo8cGF0aCBkPSJNODYuODM3NSA1MC4wNzAzTDYzLjIyNCA1NS4yNjM1TDY2LjQ3MDkgNjAuNTc2N0M2Ny40MTY1IDYyLjEyNCA2OS4yODQ2IDYyLjg0MTYgNzEuMDIyOSA2Mi4zMjUzTDg1LjYzMDQgNTcuOTg2NEM4OC4wNjE5IDU3LjI2NDIgODkuMjE1OCA1NC40OTAzIDg4LjAxMzkgNTIuMjU2Nkw4Ni44Mzc1IDUwLjA3MDNaIiBmaWxsPSIjODRBQ0YzIi8+CjxwYXRoIGQ9Ik02Ny41NzQyIDQ0LjYxOTJDNjguMzI4MyA0NC4yMjcgNjkuMTg3NyA0NC4wODUzIDcwLjAyNzggNDQuMjE0NUw4Ni4zMDUyIDQ2LjcxODhDODcuOTY4NCA0Ni45NzQ2IDg4LjMxOTggNDkuMjE2MiA4Ni44MTQ3IDQ5Ljk2ODhMNjMuMjIyNyA0Ni44ODE5TDY3LjU3NDIgNDQuNjE5MloiIGZpbGw9IiMzNzdGRkQiLz4KPHBhdGggZD0iTTU5LjkyMDIgNDQuMzE1MUM1OS40OTQyIDQzLjk4MzggNTguOTUyNCA0My44Mzg3IDU4LjQxNzggNDMuOTEyOEw0MS44NTQzIDQ2LjIwODdDNDAuMDc3MyA0Ni40NTUgMzkuNDk4MiA0OC43MzU3IDQwLjk0MjUgNDkuNzk5OUw0MS4xNzQgNDkuOTcwNUw2My4yMjI3IDQ2Ljg4MzdMNTkuOTIwMiA0NC4zMTUxWiIgZmlsbD0iIzM3N0ZGRCIvPgo8cGF0aCBkPSJNNzkuMDk3NyA3Ni4wNjI1Qzc5LjA5NzcgNzUuMDIyMyA3OS44OTUgNzQuMTU1OCA4MC45MzE2IDc0LjA2OTRMODIuMjIzMiA3My45NjE4QzgzLjM4OTMgNzMuODY0NiA4NC4zODkzIDc0Ljc4NDggODQuMzg5MyA3NS45NTQ4Vjc2Ljc5MTdDODQuMzg5MyA3Ny44MzE5IDgzLjU5MiA3OC42OTg0IDgyLjU1NTQgNzguNzg0OEw4MS4yNjM3IDc4Ljg5MjRDODAuMDk3NyA3OC45ODk2IDc5LjA5NzcgNzguMDY5NCA3OS4wOTc3IDc2Ljg5OTNWNzYuMDYyNVoiIGZpbGw9IiM3NTdDOTYiLz4KPHBhdGggZD0iTTYzLjQ0MSA1NS40ODIyQzYzLjQ0MSA1NS42MDQgNjMuMzQyMyA1NS43MDI3IDYzLjIyMDUgNTUuNzAyN0M2My4wOTg3IDU1LjcwMjcgNjMgNTUuNjA0IDYzIDU1LjQ4MjJDNjMgNTUuMzYwNCA2My4wOTg3IDU1LjI2MTcgNjMuMjIwNSA1NS4yNjE3QzYzLjM0MjMgNTUuMjYxNyA2My40NDEgNTUuMzYwNCA2My40NDEgNTUuNDgyMloiIGZpbGw9IiMwNTVGRkMiLz4KPHBhdGggZD0iTTYzLjIyMjcgNTUuMjYxN0w2NC43NjYxIDU3LjkwNzZWNTguMzQ4NUg2My4yMjI3VjU1LjI2MTdaIiBmaWxsPSIjMzc3RkZEIi8+CjxwYXRoIGQ9Ik02My4yMjI3IDU1LjI2MTdMNTguODEyOSA2My40MTk3TDYzLjIyMjcgNTguNzg5NVY1OC4zNDg1VjU1LjI2MTdaIiBmaWxsPSIjMDU1RkZDIi8+CjxwYXRoIGQ9Ik02My4yMjI3IDU1LjI2MTNMNjUuMjA3IDU0LjgyMDNMNjYuNzUwNCA2MC45OTM5TDYzLjIyMjcgNTUuMjYxM1oiIGZpbGw9IiM4NEFDRjMiLz4KPHBhdGggZD0iTTYzLjIyMjcgNTUuMjYxM0w2MS4yMzgzIDU0LjgyMDNDNjAuOTUzNCA1NS45NTk5IDYyLjUzMjUgNTYuNTY1IDYzLjA4MjEgNTUuNTI2OEw2My4yMjI3IDU1LjI2MTNaIiBmaWxsPSIjODRBQ0YzIi8+CjxjaXJjbGUgY3g9Ijk5LjAxMjgiIGN5PSIyNy40ODkzIiByPSI2LjcxNTkxIiBmaWxsPSIjMzMzMzMzIiBzdHJva2U9IiM3NjlFRUUiLz4KPHBhdGggZD0iTTY5Ljg4NDUgMzkuMTc0M0M2OS44ODQ1IDM5Ljc3OTggNjkuNjg2OCA0MC41MDE3IDY5LjMyNzkgNDEuMzAxNkM2OC45NzEzIDQyLjA5NjEgNjguNDcwMyA0Mi45MzU1IDY3Ljg5ODQgNDMuNzY2N0M2Ni43NTQ1IDQ1LjQyOTMgNjUuMzU0OCA0Ny4wMTk2IDY0LjM0NDUgNDguMDk2NkM2My44MDkzIDQ4LjY2NzIgNjIuOTMwNyA0OC42NjcyIDYyLjM5NTUgNDguMDk2NkM2MS4zODUyIDQ3LjAxOTYgNTkuOTg1NSA0NS40MjkzIDU4Ljg0MTYgNDMuNzY2N0M1OC4yNjk3IDQyLjkzNTUgNTcuNzY4NyA0Mi4wOTYxIDU3LjQxMjEgNDEuMzAxNkM1Ny4wNTMyIDQwLjUwMTcgNTYuODU1NSAzOS43Nzk4IDU2Ljg1NTUgMzkuMTc0M0M1Ni44NTU1IDM1LjUzMDcgNTkuNzc3IDMyLjU4NTkgNjMuMzcgMzIuNTg1OUM2Ni45NjMgMzIuNTg1OSA2OS44ODQ1IDM1LjUzMDcgNjkuODg0NSAzOS4xNzQzWiIgZmlsbD0iIzM3N0ZGRCIgc3Ryb2tlPSIjMDU1RkZDIi8+CjxwYXRoIGQ9Ik02My44MTM5IDQyLjA2NzlDNjMuNzU2OSA0Mi4zODgxIDYzLjUwMDQgNDIuNjUzOSA2My4xNzUyIDQyLjY1MzlDNjIuODQ3NiA0Mi42NTM5IDYyLjU3NjYgNDIuMzg1NiA2Mi42MTM4IDQyLjA2MDFDNjIuNjMxNyA0MS45MDM5IDYyLjY1NjUgNDEuNzY0MiA2Mi42ODg0IDQxLjY0MTFDNjIuNzYwNSA0MS4zNzQ1IDYyLjg3NzIgNDEuMTMxNSA2My4wMzg1IDQwLjkxMjJDNjMuMTk5NyA0MC42OTI5IDYzLjQxNCA0MC40NDM0IDYzLjY4MTQgNDAuMTYzOUM2My44NzY2IDM5Ljk2MTggNjQuMDU0OCAzOS43NzI2IDY0LjIxNiAzOS41OTYyQzY0LjM4MTUgMzkuNDE1NiA2NC41MTUyIDM5LjIyMjEgNjQuNjE3MSAzOS4wMTU3QzY0LjcxODkgMzguODA0OSA2NC43Njk4IDM4LjU1MzQgNjQuNzY5OCAzOC4yNjA5QzY0Ljc2OTggMzcuOTY0MiA2NC43MTY4IDM3LjcwODMgNjQuNjEwNyAzNy40OTMzQzY0LjUwODggMzcuMjc4MiA2NC4zNTYxIDM3LjExMjcgNjQuMTUyNCAzNi45OTY2QzYzLjk1MjkgMzYuODgwNCA2My43MDQ3IDM2LjgyMjQgNjMuNDA3NyAzNi44MjI0QzYzLjE2MTUgMzYuODIyNCA2Mi45MjgxIDM2Ljg2NzUgNjIuNzA3NSAzNi45NTc4QzYyLjQ4NjggMzcuMDQ4MiA2Mi4zMDg2IDM3LjE4NzkgNjIuMTcyOCAzNy4zNzcxQzYyLjEzNTYgMzcuNDI3OCA2Mi4xMDM0IDM3LjQ4MjcgNjIuMDc2MSAzNy41NDJDNjEuOTQxNyAzNy44MzM5IDYxLjcwNDYgMzguMTA2MSA2MS4zODMyIDM4LjEwNjFDNjEuMDU0NiAzOC4xMDYxIDYwLjc4MDMgMzcuODMzIDYwLjg1ODIgMzcuNTEzN0M2MC45MTcyIDM3LjI3MTkgNjEuMDExNyAzNy4wNTIyIDYxLjE0MTYgMzYuODU0NkM2MS4zNzUgMzYuNTA2MyA2MS42ODkgMzYuMjM5NyA2Mi4wODM3IDM2LjA1NDdDNjIuNDc4MyAzNS44Njk4IDYyLjkxOTYgMzUuNzc3MyA2My40MDc3IDM1Ljc3NzNDNjMuOTQ2NiAzNS43NzczIDY0LjQwNDkgMzUuODc2MyA2NC43ODI2IDM2LjA3NDFDNjUuMTY0NSAzNi4yNzE5IDY1LjQ1NTEgMzYuNTU1NyA2NS42NTQ2IDM2LjkyNTZDNjUuODU0IDM3LjI5MTEgNjUuOTUzOCAzNy43MjU1IDY1Ljk1MzggMzguMjI4N0M2NS45NTM4IDM4LjYxNTcgNjUuODc1MyAzOC45NzI3IDY1LjcxODIgMzkuMjk5NUM2NS41NjU1IDM5LjYyMiA2NS4zNjgyIDM5LjkyNTIgNjUuMTI2MyA0MC4yMDkxQzY0Ljg4NDQgNDAuNDkyOSA2NC42Mjc3IDQwLjc2MzggNjQuMzU2MSA0MS4wMjE5QzY0LjEyMjcgNDEuMjQxMiA2My45NjU3IDQxLjQ4ODUgNjMuODg1IDQxLjc2MzdDNjMuODU2MiA0MS44NjIzIDYzLjgzMjQgNDEuOTYzNyA2My44MTM5IDQyLjA2NzlaTTYyLjUyOTIgNDQuNjk4OEM2Mi41MjkyIDQ0LjUwNTMgNjIuNTg4NyA0NC4zNDE5IDYyLjcwNzUgNDQuMjA4NkM2Mi44MjYzIDQ0LjA3NTMgNjIuOTk4MiA0NC4wMDg2IDYzLjIyMzEgNDQuMDA4NkM2My40NTIyIDQ0LjAwODYgNjMuNjI2MiA0NC4wNzUzIDYzLjc0NSA0NC4yMDg2QzYzLjg2MzggNDQuMzQxOSA2My45MjMyIDQ0LjUwNTMgNjMuOTIzMiA0NC42OTg4QzYzLjkyMzIgNDQuODgzOCA2My44NjM4IDQ1LjA0MjkgNjMuNzQ1IDQ1LjE3NjJDNjMuNjI2MiA0NS4zMDk1IDYzLjQ1MjIgNDUuMzc2MiA2My4yMjMxIDQ1LjM3NjJDNjIuOTk4MiA0NS4zNzYyIDYyLjgyNjMgNDUuMzA5NSA2Mi43MDc1IDQ1LjE3NjJDNjIuNTg4NyA0NS4wNDI5IDYyLjUyOTIgNDQuODgzOCA2Mi41MjkyIDQ0LjY5ODhaIiBmaWxsPSJ3aGl0ZSIvPgo8Y2lyY2xlIGN4PSI2My4zNjk0IiBjeT0iMjcuMjgzNCIgcj0iMi4zNDU5MyIgZmlsbD0iIzFGMUYxRiIgc3Ryb2tlPSIjNzY5RUVFIi8+CjxwYXRoIGQ9Ik02NS4yMTQ4IDI2LjkxNDFIOTIuNTM0NiIgc3Ryb2tlPSIjNzY5RUVFIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2UtZGFzaGFycmF5PSI0IDgiLz4KPHBhdGggZD0iTTI2LjMyMDMgNDIuNDIxMUMyNi4zMjAzIDQyLjY5NzMgMjYuNTQ0MiA0Mi45MjExIDI2LjgyMDMgNDIuOTIxMUMyNy4wOTY1IDQyLjkyMTEgMjcuMzIwMyA0Mi42OTczIDI3LjMyMDMgNDIuNDIxMUgyNi4zMjAzWk0yNy4zMjAzIDQwLjYwMDlDMjcuMzIwMyA0MC4zMjQ4IDI3LjA5NjUgNDAuMTAwOSAyNi44MjAzIDQwLjEwMDlDMjYuNTQ0MiA0MC4xMDA5IDI2LjMyMDMgNDAuMzI0OCAyNi4zMjAzIDQwLjYwMDlIMjcuMzIwM1pNMjYuMzIwMyAzMy4zMTk5QzI2LjMyMDMgMzMuNTk2IDI2LjU0NDIgMzMuODE5OSAyNi44MjAzIDMzLjgxOTlDMjcuMDk2NSAzMy44MTk5IDI3LjMyMDMgMzMuNTk2IDI3LjMyMDMgMzMuMzE5OUgyNi4zMjAzWk0yNy4zMjAzIDI5LjY3OTRDMjcuMzIwMyAyOS40MDMyIDI3LjA5NjUgMjkuMTc5NCAyNi44MjAzIDI5LjE3OTRDMjYuNTQ0MiAyOS4xNzk0IDI2LjMyMDMgMjkuNDAzMiAyNi4zMjAzIDI5LjY3OTRIMjcuMzIwM1pNMjYuMzIwMyAyMi4zOTg0QzI2LjMyMDMgMjIuNjc0NSAyNi41NDQyIDIyLjg5ODQgMjYuODIwMyAyMi44OTg0QzI3LjA5NjUgMjIuODk4NCAyNy4zMjAzIDIyLjY3NDUgMjcuMzIwMyAyMi4zOTg0SDI2LjMyMDNaTTI3LjQzODcgMTkuNjcxNkMyNy41MSAxOS40MDQ4IDI3LjM1MTYgMTkuMTMwNyAyNy4wODQ4IDE5LjA1OTRDMjYuODE4IDE4Ljk4ODEgMjYuNTQ0IDE5LjE0NjYgMjYuNDcyNiAxOS40MTM0TDI3LjQzODcgMTkuNjcxNlpNMjkuNjU1NSAxNi4yMzA1QzI5LjM4ODggMTYuMzAxOCAyOS4yMzAzIDE2LjU3NTggMjkuMzAxNiAxNi44NDI2QzI5LjM3MjkgMTcuMTA5NCAyOS42NDcgMTcuMjY3OCAyOS45MTM4IDE3LjE5NjVMMjkuNjU1NSAxNi4yMzA1Wk0zMy4yMzAyIDE3LjA3ODFDMzMuNTA2MyAxNy4wNzgxIDMzLjczMDIgMTYuODU0MyAzMy43MzAyIDE2LjU3ODFDMzMuNzMwMiAxNi4zMDIgMzMuNTA2MyAxNi4wNzgxIDMzLjIzMDIgMTYuMDc4MVYxNy4wNzgxWk00Mi44Njk3IDE2LjA3ODFDNDIuNTkzNiAxNi4wNzgxIDQyLjM2OTcgMTYuMzAyIDQyLjM2OTcgMTYuNTc4MUM0Mi4zNjk3IDE2Ljg1NDMgNDIuNTkzNiAxNy4wNzgxIDQyLjg2OTcgMTcuMDc4MVYxNi4wNzgxWk00Ny42ODk1IDE3LjA3ODFDNDcuOTY1NiAxNy4wNzgxIDQ4LjE4OTUgMTYuODU0MyA0OC4xODk1IDE2LjU3ODFDNDguMTg5NSAxNi4zMDIgNDcuOTY1NiAxNi4wNzgxIDQ3LjY4OTUgMTYuMDc4MVYxNy4wNzgxWk01Ny4zMjkgMTYuMDc4MUM1Ny4wNTI5IDE2LjA3ODEgNTYuODI5IDE2LjMwMiA1Ni44MjkgMTYuNTc4MUM1Ni44MjkgMTYuODU0MyA1Ny4wNTI5IDE3LjA3ODEgNTcuMzI5IDE3LjA3ODFWMTYuMDc4MVpNNjAuNjQ1NSAxNy4xOTY1QzYwLjkxMjIgMTcuMjY3OCA2MS4xODYzIDE3LjEwOTQgNjEuMjU3NiAxNi44NDI2QzYxLjMyODkgMTYuNTc1OCA2MS4xNzA1IDE2LjMwMTggNjAuOTAzNyAxNi4yMzA1TDYwLjY0NTUgMTcuMTk2NVpNNjQuMDg2NiAxOS40MTM0QzY0LjAxNTMgMTkuMTQ2NiA2My43NDEyIDE4Ljk4ODEgNjMuNDc0NCAxOS4wNTk0QzYzLjIwNzcgMTkuMTMwNyA2My4wNDkyIDE5LjQwNDggNjMuMTIwNSAxOS42NzE2TDY0LjA4NjYgMTkuNDEzNFpNNjMuMjM4OSAyMS4yOTg1QzYzLjIzODkgMjEuNTc0NyA2My40NjI4IDIxLjc5ODUgNjMuNzM4OSAyMS43OTg1QzY0LjAxNTEgMjEuNzk4NSA2NC4yMzg5IDIxLjU3NDcgNjQuMjM4OSAyMS4yOTg1SDYzLjIzODlaTTY0LjIzODkgMjQuMTgwMUM2NC4yMzg5IDIzLjkwMzkgNjQuMDE1MSAyMy42ODAxIDYzLjczODkgMjMuNjgwMUM2My40NjI4IDIzLjY4MDEgNjMuMjM4OSAyMy45MDM5IDYzLjIzODkgMjQuMTgwMUg2NC4yMzg5Wk0yNy4zMjAzIDQyLjQyMTFWNDAuNjAwOUgyNi4zMjAzVjQyLjQyMTFIMjcuMzIwM1pNMjcuMzIwMyAzMy4zMTk5VjI5LjY3OTRIMjYuMzIwM1YzMy4zMTk5SDI3LjMyMDNaTTI3LjMyMDMgMjIuMzk4NFYyMC41NzgxSDI2LjMyMDNWMjIuMzk4NEgyNy4zMjAzWk0yNy4zMjAzIDIwLjU3ODFDMjcuMzIwMyAyMC4yNjM5IDI3LjM2MTYgMTkuOTYwMiAyNy40Mzg3IDE5LjY3MTZMMjYuNDcyNiAxOS40MTM0QzI2LjM3MzIgMTkuNzg1NCAyNi4zMjAzIDIwLjE3NiAyNi4zMjAzIDIwLjU3ODFIMjcuMzIwM1pNMjkuOTEzOCAxNy4xOTY1QzMwLjIwMjQgMTcuMTE5NCAzMC41MDYxIDE3LjA3ODEgMzAuODIwMyAxNy4wNzgxVjE2LjA3ODFDMzAuNDE4MiAxNi4wNzgxIDMwLjAyNzYgMTYuMTMxIDI5LjY1NTUgMTYuMjMwNUwyOS45MTM4IDE3LjE5NjVaTTMwLjgyMDMgMTcuMDc4MUgzMy4yMzAyVjE2LjA3ODFIMzAuODIwM1YxNy4wNzgxWk00Mi44Njk3IDE3LjA3ODFINDcuNjg5NVYxNi4wNzgxSDQyLjg2OTdWMTcuMDc4MVpNNTcuMzI5IDE3LjA3ODFINTkuNzM4OVYxNi4wNzgxSDU3LjMyOVYxNy4wNzgxWk01OS43Mzg5IDE3LjA3ODFDNjAuMDUzMSAxNy4wNzgxIDYwLjM1NjkgMTcuMTE5NCA2MC42NDU1IDE3LjE5NjVMNjAuOTAzNyAxNi4yMzA1QzYwLjUzMTYgMTYuMTMxIDYwLjE0MTEgMTYuMDc4MSA1OS43Mzg5IDE2LjA3ODFWMTcuMDc4MVpNNjMuMTIwNSAxOS42NzE2QzYzLjE5NzYgMTkuOTYwMiA2My4yMzg5IDIwLjI2MzkgNjMuMjM4OSAyMC41NzgxSDY0LjIzODlDNjQuMjM4OSAyMC4xNzYgNjQuMTg2IDE5Ljc4NTQgNjQuMDg2NiAxOS40MTM0TDYzLjEyMDUgMTkuNjcxNlpNNjMuMjM4OSAyMC41NzgxVjIxLjI5ODVINjQuMjM4OVYyMC41NzgxSDYzLjIzODlaTTYzLjIzODkgMjQuMTgwMVYyNC45MDA1SDY0LjIzODlWMjQuMTgwMUg2My4yMzg5WiIgZmlsbD0iIzc2OUVFRSIvPgo8cGF0aCBkPSJNMTAwLjE5NSAyNS4zNzE3QzEwMC4yNDMgMjUuMjExNSAxMDAuMTI3IDI1LjA0OTEgOTkuOTM2OCAyNS4wMDlDOTkuNzQ2NCAyNC45Njg5IDk5LjU1MzUgMjUuMDY2NCA5OS41MDU5IDI1LjIyNjZMOTcuOTAyIDMwLjYyODNDOTcuODU0NCAzMC43ODg1IDk3Ljk3MDEgMzAuOTUwOSA5OC4xNjA0IDMwLjk5MUM5OC4zNTA4IDMxLjAzMTEgOTguNTQzNyAzMC45MzM2IDk4LjU5MTMgMzAuNzczNEwxMDAuMTk1IDI1LjM3MTdaIiBmaWxsPSIjRkFGQUZBIi8+CjxwYXRoIGQ9Ik05Ni44NjQ5IDI1LjgxMjVMOTQuNjA0MSAyNy43MTZDOTQuNDY1MyAyNy44MzI4IDk0LjQ2NTMgMjguMDIyMSA5NC42MDQxIDI4LjEzOUw5Ni44NjQ5IDMwLjA0MjRDOTcuMDAzNyAzMC4xNTkyIDk3LjIyODYgMzAuMTU5MiA5Ny4zNjc0IDMwLjA0MjRDOTcuNTA2MSAyOS45MjU2IDk3LjUwNjEgMjkuNzM2MiA5Ny4zNjc0IDI5LjYxOTRMOTUuMzU3NyAyNy45Mjc1TDk3LjM2NzQgMjYuMjM1NUM5Ny41MDYxIDI2LjExODcgOTcuNTA2MSAyNS45MjkzIDk3LjM2NzQgMjUuODEyNUM5Ny4yMjg2IDI1LjY5NTcgOTcuMDAzNyAyNS42OTU3IDk2Ljg2NDkgMjUuODEyNVoiIGZpbGw9IiNGQUZBRkEiLz4KPHBhdGggZD0iTTEwMS4xMzUgMjUuODEyNUwxMDMuMzk2IDI3LjcxNkMxMDMuNTM1IDI3LjgzMjggMTAzLjUzNSAyOC4wMjIxIDEwMy4zOTYgMjguMTM5TDEwMS4xMzUgMzAuMDQyNEMxMDAuOTk2IDMwLjE1OTIgMTAwLjc3MSAzMC4xNTkyIDEwMC42MzMgMzAuMDQyNEMxMDAuNDk0IDI5LjkyNTYgMTAwLjQ5NCAyOS43MzYyIDEwMC42MzMgMjkuNjE5NEwxMDIuNjQyIDI3LjkyNzVMMTAwLjYzMyAyNi4yMzU1QzEwMC40OTQgMjYuMTE4NyAxMDAuNDk0IDI1LjkyOTMgMTAwLjYzMyAyNS44MTI1QzEwMC43NzEgMjUuNjk1NyAxMDAuOTk2IDI1LjY5NTcgMTAxLjEzNSAyNS44MTI1WiIgZmlsbD0iI0ZBRkFGQSIvPgo8Y2lyY2xlIGN4PSIyNi44MjEyIiBjeT0iNDkuMDcxMiIgcj0iNi44ODM3MiIgZmlsbD0iIzMzMzMzMyIgc3Ryb2tlPSIjOEJCM0ZBIi8+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8xMzM2M18xMDc3MDIpIj4KPHBhdGggZD0iTTI2IDQ3LjI0NjFIMjUuNDY4NVY0Ni43NDYxSDI2QzI2LjQxNDIgNDYuNzQ2MSAyNi43NSA0Ny4wODE5IDI2Ljc1IDQ3LjQ5NjFWNDguNDk2MUMyNi43NSA0OC42MzQyIDI2Ljg2MTkgNDguNzQ2MSAyNyA0OC43NDYxSDI4LjUzMTVWNDkuMjQ2MUgyN0MyNi45MTIzIDQ5LjI0NjEgMjYuODI4MiA0OS4yMzExIDI2Ljc1IDQ5LjIwMzRWNTEuNDk2MUMyNi43NSA1MS42MzQyIDI2Ljg2MTkgNTEuNzQ2MSAyNyA1MS43NDYxSDI4LjUzMTVWNTIuMjQ2MUgyN0MyNi41ODU4IDUyLjI0NjEgMjYuMjUgNTEuOTEwMyAyNi4yNSA1MS40OTYxVjQ3LjQ5NjFDMjYuMjUgNDcuMzU4IDI2LjEzODEgNDcuMjQ2MSAyNiA0Ny4yNDYxWiIgZmlsbD0iI0ZBRkFGQSIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTI5LjUgNDkuNDk2MUMyOS43NzYxIDQ5LjQ5NjEgMzAgNDkuMjcyMiAzMCA0OC45OTYxQzMwIDQ4LjcyIDI5Ljc3NjEgNDguNDk2MSAyOS41IDQ4LjQ5NjFDMjkuMjIzOSA0OC40OTYxIDI5IDQ4LjcyIDI5IDQ4Ljk5NjFDMjkgNDkuMjcyMiAyOS4yMjM5IDQ5LjQ5NjEgMjkuNSA0OS40OTYxWk0yOS41IDQ5Ljk5NjFDMzAuMDUyMyA0OS45OTYxIDMwLjUgNDkuNTQ4NCAzMC41IDQ4Ljk5NjFDMzAuNSA0OC40NDM4IDMwLjA1MjMgNDcuOTk2MSAyOS41IDQ3Ljk5NjFDMjguOTQ3NyA0Ny45OTYxIDI4LjUgNDguNDQzOCAyOC41IDQ4Ljk5NjFDMjguNSA0OS41NDg0IDI4Ljk0NzcgNDkuOTk2MSAyOS41IDQ5Ljk5NjFaIiBmaWxsPSIjRkFGQUZBIi8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMjkuNSA1Mi40OTYxQzI5Ljc3NjEgNTIuNDk2MSAzMCA1Mi4yNzIyIDMwIDUxLjk5NjFDMzAgNTEuNzIgMjkuNzc2MSA1MS40OTYxIDI5LjUgNTEuNDk2MUMyOS4yMjM5IDUxLjQ5NjEgMjkgNTEuNzIgMjkgNTEuOTk2MUMyOSA1Mi4yNzIyIDI5LjIyMzkgNTIuNDk2MSAyOS41IDUyLjQ5NjFaTTI5LjUgNTIuOTk2MUMzMC4wNTIzIDUyLjk5NjEgMzAuNSA1Mi41NDg0IDMwLjUgNTEuOTk2MUMzMC41IDUxLjQ0MzggMzAuMDUyMyA1MC45OTYxIDI5LjUgNTAuOTk2MUMyOC45NDc3IDUwLjk5NjEgMjguNSA1MS40NDM4IDI4LjUgNTEuOTk2MUMyOC41IDUyLjU0ODQgMjguOTQ3NyA1Mi45OTYxIDI5LjUgNTIuOTk2MVoiIGZpbGw9IiNGQUZBRkEiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0yNC41IDQ3LjQ5NjFDMjQuNzc2MSA0Ny40OTYxIDI1IDQ3LjI3MjIgMjUgNDYuOTk2MUMyNSA0Ni43MiAyNC43NzYxIDQ2LjQ5NjEgMjQuNSA0Ni40OTYxQzI0LjIyMzkgNDYuNDk2MSAyNCA0Ni43MiAyNCA0Ni45OTYxQzI0IDQ3LjI3MjIgMjQuMjIzOSA0Ny40OTYxIDI0LjUgNDcuNDk2MVpNMjQuNSA0Ny45OTYxQzI1LjA1MjMgNDcuOTk2MSAyNS41IDQ3LjU0ODQgMjUuNSA0Ni45OTYxQzI1LjUgNDYuNDQzOCAyNS4wNTIzIDQ1Ljk5NjEgMjQuNSA0NS45OTYxQzIzLjk0NzcgNDUuOTk2MSAyMy41IDQ2LjQ0MzggMjMuNSA0Ni45OTYxQzIzLjUgNDcuNTQ4NCAyMy45NDc3IDQ3Ljk5NjEgMjQuNSA0Ny45OTYxWiIgZmlsbD0iI0ZBRkFGQSIvPgo8L2c+CjxkZWZzPgo8Y2xpcFBhdGggaWQ9ImNsaXAwXzEzMzYzXzEwNzcwMiI+CjxyZWN0IHdpZHRoPSI3LjkzNzUiIGhlaWdodD0iNy45Mzc1IiBmaWxsPSJ3aGl0ZSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjMuMTI4OSA0NS4zNzUpIi8+CjwvY2xpcFBhdGg+CjwvZGVmcz4KPC9zdmc+Cg=="
                  : "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0MCIgdmlld0JveD0iMCAwIDMyMCAyNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjE2MCIgY3k9IjEyMCIgcj0iMTIwIiBmaWxsPSIjRURGM0ZCIi8+CjxyZWN0IHg9IjE2IiB5PSIxODUiIHdpZHRoPSIyODgiIGhlaWdodD0iNCIgcng9IjIiIGZpbGw9IiM4NEFDRjMiLz4KPHBhdGggZD0iTTExMC41IDExMkwxNjAuNSAxMjRWMTg1SDExNC43MDlDMTEyLjUwNSAxODUgMTEwLjcxNiAxODMuMjE3IDExMC43MDkgMTgxLjAxMkwxMTAuNSAxMTJaIiBmaWxsPSIjMDU1RkZDIi8+CjxwYXRoIGQ9Ik0yMTQuMDQ5IDExMkwxNjAuNSAxMjRWMTg1SDIxMC4wNDlDMjEyLjI1OCAxODUgMjE0LjA0OSAxODMuMjA5IDIxNC4wNDkgMTgxVjExMloiIGZpbGw9IiMzNzdGRkQiLz4KPHBhdGggZD0iTTExMC41IDExMi4xODlMMTYwLjcxOCAxMDVMMjE0LjUgMTEyLjQxOEwxNjAuNSAxMjRMMTEwLjUgMTEyLjE4OVoiIGZpbGw9IiNFREYzRkIiLz4KPHBhdGggZD0iTTExMC41IDExMkwxNjAuNSAxMjRMMTUyLjA1MyAxMzkuNjI3QzE1MS4xNDkgMTQxLjI5OSAxNDkuMTkzIDE0Mi4xMDQgMTQ3LjM3NCAxNDEuNTUzTDEwNS45NTcgMTI5LjAwMkMxMDMuNDUgMTI4LjI0MiAxMDIuMzM4IDEyNS4zMTggMTAzLjcwNyAxMjMuMDg0TDExMC41IDExMloiIGZpbGw9IiM4NEFDRjMiLz4KPHBhdGggZD0iTTIxNC4wNDkgMTEyLjIyNEwxNjAuNSAxMjRMMTY5Ljg5NiAxMzkuMzc2QzE3MC44NDIgMTQwLjkyMyAxNzIuNzEgMTQxLjY0MSAxNzQuNDQ4IDE0MS4xMjVMMjE3LjI4NyAxMjguNEMyMTkuNzE4IDEyNy42NzggMjIwLjg3MiAxMjQuOTA0IDIxOS42NyAxMjIuNjcxTDIxNC4wNDkgMTEyLjIyNFoiIGZpbGw9IiM4NEFDRjMiLz4KPHBhdGggZD0iTTE3MS44MzkgOTkuMTAzNUMxNzIuNTkzIDk4LjcxMTQgMTczLjQ1MyA5OC41Njk3IDE3NC4yOTMgOTguNjk4OUwyMTguNzg5IDEwNS41NDVDMjIwLjcxNiAxMDUuODQxIDIyMS4xMjQgMTA4LjQzOCAyMTkuMzggMTA5LjMxTDIxNCAxMTJMMTYwLjUgMTA1TDE3MS44MzkgOTkuMTAzNVoiIGZpbGw9IiMzNzdGRkQiLz4KPHBhdGggZD0iTTE1Mi4xNjYgOTguNTE4M0MxNTEuNzQgOTguMTg2OSAxNTEuMTk4IDk4LjA0MTggMTUwLjY2NCA5OC4xMTU5TDEwNS44NjkgMTA0LjMyNUMxMDQuMDkyIDEwNC41NzEgMTAzLjUxMyAxMDYuODUyIDEwNC45NTggMTA3LjkxNkwxMTAuNSAxMTJMMTYwLjUgMTA1TDE1Mi4xNjYgOTguNTE4M1oiIGZpbGw9IiMzNzdGRkQiLz4KPHBhdGggZD0iTTE5Ni41IDE2OC44NEMxOTYuNSAxNjcuOCAxOTcuMjk3IDE2Ni45MzQgMTk4LjMzNCAxNjYuODQ3TDIwNi4zMzQgMTY2LjE4MUMyMDcuNSAxNjYuMDgzIDIwOC41IDE2Ny4wMDQgMjA4LjUgMTY4LjE3NFYxNzUuMTZDMjA4LjUgMTc2LjIgMjA3LjcwMyAxNzcuMDY2IDIwNi42NjYgMTc3LjE1M0wxOTguNjY2IDE3Ny44MTlDMTk3LjUgMTc3LjkxNyAxOTYuNSAxNzYuOTk2IDE5Ni41IDE3NS44MjZWMTY4Ljg0WiIgZmlsbD0iIzA0Mjg2NiIvPgo8cGF0aCBkPSJNMTYxIDEyNC41QzE2MSAxMjQuNzc2IDE2MC43NzYgMTI1IDE2MC41IDEyNUMxNjAuMjI0IDEyNSAxNjAgMTI0Ljc3NiAxNjAgMTI0LjVDMTYwIDEyNC4yMjQgMTYwLjIyNCAxMjQgMTYwLjUgMTI0QzE2MC43NzYgMTI0IDE2MSAxMjQuMjI0IDE2MSAxMjQuNVoiIGZpbGw9IiMwNTVGRkMiLz4KPHBhdGggZD0iTTE2MC41IDEyNEwxNjQgMTMwVjEzMUgxNjAuNVYxMjRaIiBmaWxsPSIjMzc3RkZEIi8+CjxwYXRoIGQ9Ik0xNjAuNSAxMjRMMTUwLjUgMTQyLjVMMTYwLjUgMTMyVjEzMVYxMjRaIiBmaWxsPSIjMDU1RkZDIi8+CjxwYXRoIGQ9Ik0xNjAuNSAxMjRMMTY1IDEyM0wxNjguNSAxMzdMMTYwLjUgMTI0WiIgZmlsbD0iIzg0QUNGMyIvPgo8cGF0aCBkPSJNMTYwLjUgMTI0TDE1NiAxMjNMMTU1LjQ5MSAxMjUuMDM4QzE1NC45MTggMTI3LjMyOSAxNTguMDkzIDEyOC41NDYgMTU5LjE5OCAxMjYuNDU4TDE2MC41IDEyNFoiIGZpbGw9IiM4NEFDRjMiLz4KPGNpcmNsZSBjeD0iMjQyIiBjeT0iNjAiIHI9IjE1IiBmaWxsPSIjODRBQ0YzIiBzdHJva2U9IiMwNTVGRkMiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBkPSJNMTc2IDg4QzE3NiA4OS41OTA2IDE3NS40MDEgOTEuNTEwMSAxNzQuMzU2IDkzLjYxNjVDMTczLjMxOSA5NS43MDcgMTcxLjg4NSA5Ny44OTggMTcwLjMxNCAxMDAuMDA5QzE2Ny4xNzIgMTA0LjIzIDE2My41NDYgMTA4LjA0NiAxNjEuNjM0IDEwOS45NzJDMTYxLjI3NiAxMTAuMzMyIDE2MC43MjQgMTEwLjMzMiAxNjAuMzY2IDEwOS45NzJDMTU4LjQ1NCAxMDguMDQ2IDE1NC44MjggMTA0LjIzIDE1MS42ODYgMTAwLjAwOUMxNTAuMTE1IDk3Ljg5OCAxNDguNjgxIDk1LjcwNyAxNDcuNjQ0IDkzLjYxNjVDMTQ2LjU5OSA5MS41MTAxIDE0NiA4OS41OTA2IDE0NiA4OEMxNDYgNzkuNzE1NyAxNTIuNzE2IDczIDE2MSA3M0MxNjkuMjg0IDczIDE3NiA3OS43MTU3IDE3NiA4OFoiIGZpbGw9IiMzNzdGRkQiIHN0cm9rZT0iIzA1NUZGQyIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Ik0xNjEuOTc4IDkzLjc2MzRDMTYxLjkwOCA5NC4zMTExIDE2MS40NjkgOTQuNzYwOCAxNjAuOTE2IDk0Ljc2MDhIMTYwLjE3OEMxNTkuNjIyIDk0Ljc2MDggMTU5LjE2NiA5NC4zMDU5IDE1OS4yMTEgOTMuNzUxNEMxNTkuMjUyIDkzLjI0ODIgMTU5LjMyMSA5Mi44MTEgMTU5LjQxOSA5Mi40Mzk1QzE1OS41ODYgOTEuODI4NCAxNTkuODU3IDkxLjI3MTUgMTYwLjIzMiA5MC43Njg4QzE2MC42MDYgOTAuMjY2MSAxNjEuMTAzIDg5LjY5NDQgMTYxLjcyNCA4OS4wNTM4QzE2Mi4xNzcgODguNTkwNSAxNjIuNTkxIDg4LjE1NjggMTYyLjk2NiA4Ny43NTI3QzE2My4zNSA4Ny4zMzg3IDE2My42NiA4Ni44OTUyIDE2My44OTcgODYuNDIyQzE2NC4xMzMgODUuOTM5MSAxNjQuMjUxIDg1LjM2MjUgMTY0LjI1MSA4NC42OTIyQzE2NC4yNTEgODQuMDEyMSAxNjQuMTI4IDgzLjQyNTYgMTYzLjg4MiA4Mi45MzI4QzE2My42NDUgODIuNDQgMTYzLjI5MSA4Mi4wNjA1IDE2Mi44MTggODEuNzk0NEMxNjIuMzU1IDgxLjUyODIgMTYxLjc3OCA4MS4zOTUyIDE2MS4wODkgODEuMzk1MkMxNjAuNTE3IDgxLjM5NTIgMTU5Ljk3NSA4MS40OTg3IDE1OS40NjMgODEuNzA1NkMxNTguOTUxIDgxLjkxMjYgMTU4LjUzNyA4Mi4yMzMgMTU4LjIyMiA4Mi42NjY3QzE1OC4wNzEgODIuODY5MSAxNTcuOTU1IDgzLjEwMTggMTU3Ljg3NCA4My4zNjQ5QzE1Ny43MTQgODMuODg3NCAxNTcuMjk1IDg0LjMzNzQgMTU2Ljc0OCA4NC4zMzc0SDE1Ni4wMThDMTU1LjQ1OSA4NC4zMzc0IDE1NC45OTcgODMuODc1NSAxNTUuMDk2IDgzLjMyNTFDMTU1LjIyIDgyLjYzMjkgMTU1LjQ2NCA4Mi4wMTQyIDE1NS44MjggODEuNDY5MUMxNTYuMzY5IDgwLjY3MDcgMTU3LjA5OSA4MC4wNTk2IDE1OC4wMTUgNzkuNjM1OEMxNTguOTMxIDc5LjIxMTkgMTU5Ljk1NiA3OSAxNjEuMDg5IDc5QzE2Mi4zNCA3OSAxNjMuNDA0IDc5LjIyNjcgMTY0LjI4MSA3OS42ODAxQzE2NS4xNjcgODAuMTMzNSAxNjUuODQyIDgwLjc4NDEgMTY2LjMwNSA4MS42MzE3QzE2Ni43NjggODIuNDY5NSAxNjcgODMuNDY1MSAxNjcgODQuNjE4M0MxNjcgODUuNTA1NCAxNjYuODE4IDg2LjMyMzUgMTY2LjQ1MyA4Ny4wNzI2QzE2Ni4wOTkgODcuODExOCAxNjUuNjQgODguNTA2NyAxNjUuMDc5IDg5LjE1NzNDMTY0LjUxNyA4OS44MDc4IDE2My45MjEgOTAuNDI4OCAxNjMuMjkxIDkxLjAyMDJDMTYyLjc0OSA5MS41MjI5IDE2Mi4zODQgOTIuMDg5NiAxNjIuMTk3IDkyLjcyMDRDMTYyLjA5OCA5My4wNTQzIDE2Mi4wMjUgOTMuNDAxOSAxNjEuOTc4IDkzLjc2MzRaTTE1OS4wNDkgOTkuNDQ3NkMxNTkuMDQ5IDk5LjAwNCAxNTkuMTg3IDk4LjYyOTUgMTU5LjQ2MyA5OC4zMjM5QzE1OS43MzkgOTguMDE4NCAxNjAuMTM4IDk3Ljg2NTYgMTYwLjY2IDk3Ljg2NTZDMTYxLjE5MiA5Ny44NjU2IDE2MS41OTYgOTguMDE4NCAxNjEuODcyIDk4LjMyMzlDMTYyLjE0OCA5OC42Mjk1IDE2Mi4yODYgOTkuMDA0IDE2Mi4yODYgOTkuNDQ3NkMxNjIuMjg2IDk5Ljg3MTQgMTYyLjE0OCAxMDAuMjM2IDE2MS44NzIgMTAwLjU0MkMxNjEuNTk2IDEwMC44NDcgMTYxLjE5MiAxMDEgMTYwLjY2IDEwMUMxNjAuMTM4IDEwMSAxNTkuNzM5IDEwMC44NDcgMTU5LjQ2MyAxMDAuNTQyQzE1OS4xODcgMTAwLjIzNiAxNTkuMDQ5IDk5Ljg3MTQgMTU5LjA0OSA5OS40NDc2WiIgZmlsbD0id2hpdGUiLz4KPGNpcmNsZSBjeD0iMTYxIiBjeT0iNjAiIHI9IjUiIGZpbGw9IndoaXRlIiBzdHJva2U9IiMwNTVGRkMiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBkPSJNMTY3LjU1IDYxQzE2OC4xMDIgNjEgMTY4LjU1IDYwLjU1MjMgMTY4LjU1IDYwQzE2OC41NSA1OS40NDc3IDE2OC4xMDIgNTkgMTY3LjU1IDU5VjYxWk0xNzUuNzUgNTlDMTc1LjE5OCA1OSAxNzQuNzUgNTkuNDQ3NyAxNzQuNzUgNjBDMTc0Ljc1IDYwLjU1MjMgMTc1LjE5OCA2MSAxNzUuNzUgNjFWNTlaTTE3OS44NSA2MUMxODAuNDAyIDYxIDE4MC44NSA2MC41NTIzIDE4MC44NSA2MEMxODAuODUgNTkuNDQ3NyAxODAuNDAyIDU5IDE3OS44NSA1OVY2MVpNMTg4LjA1IDU5QzE4Ny40OTggNTkgMTg3LjA1IDU5LjQ0NzcgMTg3LjA1IDYwQzE4Ny4wNSA2MC41NTIzIDE4Ny40OTggNjEgMTg4LjA1IDYxVjU5Wk0xOTIuMTUgNjFDMTkyLjcwMiA2MSAxOTMuMTUgNjAuNTUyMyAxOTMuMTUgNjBDMTkzLjE1IDU5LjQ0NzcgMTkyLjcwMiA1OSAxOTIuMTUgNTlWNjFaTTIwMC4zNSA1OUMxOTkuNzk4IDU5IDE5OS4zNSA1OS40NDc3IDE5OS4zNSA2MEMxOTkuMzUgNjAuNTUyMyAxOTkuNzk4IDYxIDIwMC4zNSA2MVY1OVpNMjA0LjQ1IDYxQzIwNS4wMDIgNjEgMjA1LjQ1IDYwLjU1MjMgMjA1LjQ1IDYwQzIwNS40NSA1OS40NDc3IDIwNS4wMDIgNTkgMjA0LjQ1IDU5VjYxWk0yMTIuNjUgNTlDMjEyLjA5OCA1OSAyMTEuNjUgNTkuNDQ3NyAyMTEuNjUgNjBDMjExLjY1IDYwLjU1MjMgMjEyLjA5OCA2MSAyMTIuNjUgNjFWNTlaTTIxNi43NSA2MUMyMTcuMzAyIDYxIDIxNy43NSA2MC41NTIzIDIxNy43NSA2MEMyMTcuNzUgNTkuNDQ3NyAyMTcuMzAyIDU5IDIxNi43NSA1OVY2MVpNMjI0Ljk1IDU5QzIyNC4zOTggNTkgMjIzLjk1IDU5LjQ0NzcgMjIzLjk1IDYwQzIyMy45NSA2MC41NTIzIDIyNC4zOTggNjEgMjI0Ljk1IDYxVjU5Wk0xNjUuNSA2MUgxNjcuNTVWNTlIMTY1LjVWNjFaTTE3NS43NSA2MUgxNzkuODVWNTlIMTc1Ljc1VjYxWk0xODguMDUgNjFIMTkyLjE1VjU5SDE4OC4wNVY2MVpNMjAwLjM1IDYxSDIwNC40NVY1OUgyMDAuMzVWNjFaTTIxMi42NSA2MUgyMTYuNzVWNTlIMjEyLjY1VjYxWk0yMjQuOTUgNjFIMjI3VjU5SDIyNC45NVY2MVoiIGZpbGw9IiMwNTVGRkMiLz4KPHBhdGggZD0iTTc3IDk1Qzc3IDk1LjU1MjMgNzcuNDQ3NyA5NiA3OCA5NkM3OC41NTIzIDk2IDc5IDk1LjU1MjMgNzkgOTVINzdaTTc5IDkzLjE2NjdDNzkgOTIuNjE0NCA3OC41NTIzIDkyLjE2NjcgNzggOTIuMTY2N0M3Ny40NDc3IDkyLjE2NjcgNzcgOTIuNjE0NCA3NyA5My4xNjY3SDc5Wk03NyA4NS44MzMzQzc3IDg2LjM4NTYgNzcuNDQ3NyA4Ni44MzMzIDc4IDg2LjgzMzNDNzguNTUyMyA4Ni44MzMzIDc5IDg2LjM4NTYgNzkgODUuODMzM0g3N1pNNzkgODIuMTY2N0M3OSA4MS42MTQ0IDc4LjU1MjMgODEuMTY2NyA3OCA4MS4xNjY3Qzc3LjQ0NzcgODEuMTY2NyA3NyA4MS42MTQ0IDc3IDgyLjE2NjdINzlaTTc3IDc0LjgzMzNDNzcgNzUuMzg1NiA3Ny40NDc3IDc1LjgzMzMgNzggNzUuODMzM0M3OC41NTIzIDc1LjgzMzMgNzkgNzUuMzg1NiA3OSA3NC44MzMzSDc3Wk03OSA3MS4xNjY3Qzc5IDcwLjYxNDQgNzguNTUyMyA3MC4xNjY3IDc4IDcwLjE2NjdDNzcuNDQ3NyA3MC4xNjY3IDc3IDcwLjYxNDQgNzcgNzEuMTY2N0g3OVpNNzcgNjMuODMzM0M3NyA2NC4zODU2IDc3LjQ0NzcgNjQuODMzMyA3OCA2NC44MzMzQzc4LjU1MjMgNjQuODMzMyA3OSA2NC4zODU2IDc5IDYzLjgzMzNINzdaTTc5IDYwLjE2NjdDNzkgNTkuNjE0NCA3OC41NTIzIDU5LjE2NjcgNzggNTkuMTY2N0M3Ny40NDc3IDU5LjE2NjcgNzcgNTkuNjE0NCA3NyA2MC4xNjY3SDc5Wk03NyA1Mi44MzMzQzc3IDUzLjM4NTYgNzcuNDQ3NyA1My44MzMzIDc4IDUzLjgzMzNDNzguNTUyMyA1My44MzMzIDc5IDUzLjM4NTYgNzkgNTIuODMzM0g3N1pNNzkgNDkuMTY2N0M3OSA0OC42MTQ0IDc4LjU1MjMgNDguMTY2NyA3OCA0OC4xNjY3Qzc3LjQ0NzcgNDguMTY2NyA3NyA0OC42MTQ0IDc3IDQ5LjE2NjdINzlaTTc3IDQxLjgzMzNDNzcgNDIuMzg1NiA3Ny40NDc3IDQyLjgzMzMgNzggNDIuODMzM0M3OC41NTIzIDQyLjgzMzMgNzkgNDIuMzg1NiA3OSA0MS44MzMzSDc3Wk03OS4xMDE1IDM5LjIyMjZDNzkuMjQ0MSAzOC42ODkgNzguOTI3MiAzOC4xNDA5IDc4LjM5MzYgMzcuOTk4M0M3Ny44NjAxIDM3Ljg1NTYgNzcuMzExOSAzOC4xNzI2IDc3LjE2OTMgMzguNzA2MUw3OS4xMDE1IDM5LjIyMjZaTTgwLjcwNjEgMzUuMTY5M0M4MC4xNzI2IDM1LjMxMTkgNzkuODU1NiAzNS44NjAxIDc5Ljk5ODMgMzYuMzkzNkM4MC4xNDA5IDM2LjkyNzIgODAuNjg5IDM3LjI0NDEgODEuMjIyNiAzNy4xMDE1TDgwLjcwNjEgMzUuMTY5M1pNODQuMDgzMyAzN0M4NC42MzU2IDM3IDg1LjA4MzMgMzYuNTUyMyA4NS4wODMzIDM2Qzg1LjA4MzMgMzUuNDQ3NyA4NC42MzU2IDM1IDg0LjA4MzMgMzVWMzdaTTkyLjQxNjcgMzVDOTEuODY0NCAzNSA5MS40MTY3IDM1LjQ0NzcgOTEuNDE2NyAzNkM5MS40MTY3IDM2LjU1MjMgOTEuODY0NCAzNyA5Mi40MTY3IDM3VjM1Wk05Ni41ODMzIDM3Qzk3LjEzNTYgMzcgOTcuNTgzMyAzNi41NTIzIDk3LjU4MzMgMzZDOTcuNTgzMyAzNS40NDc3IDk3LjEzNTYgMzUgOTYuNTgzMyAzNVYzN1pNMTA0LjkxNyAzNUMxMDQuMzY0IDM1IDEwMy45MTcgMzUuNDQ3NyAxMDMuOTE3IDM2QzEwMy45MTcgMzYuNTUyMyAxMDQuMzY0IDM3IDEwNC45MTcgMzdWMzVaTTEwOS4wODMgMzdDMTA5LjYzNiAzNyAxMTAuMDgzIDM2LjU1MjMgMTEwLjA4MyAzNkMxMTAuMDgzIDM1LjQ0NzcgMTA5LjYzNiAzNSAxMDkuMDgzIDM1VjM3Wk0xMTcuNDE3IDM1QzExNi44NjQgMzUgMTE2LjQxNyAzNS40NDc3IDExNi40MTcgMzZDMTE2LjQxNyAzNi41NTIzIDExNi44NjQgMzcgMTE3LjQxNyAzN1YzNVpNMTIxLjU4MyAzN0MxMjIuMTM2IDM3IDEyMi41ODMgMzYuNTUyMyAxMjIuNTgzIDM2QzEyMi41ODMgMzUuNDQ3NyAxMjIuMTM2IDM1IDEyMS41ODMgMzVWMzdaTTEyOS45MTcgMzVDMTI5LjM2NCAzNSAxMjguOTE3IDM1LjQ0NzcgMTI4LjkxNyAzNkMxMjguOTE3IDM2LjU1MjMgMTI5LjM2NCAzNyAxMjkuOTE3IDM3VjM1Wk0xMzQuMDgzIDM3QzEzNC42MzYgMzcgMTM1LjA4MyAzNi41NTIzIDEzNS4wODMgMzZDMTM1LjA4MyAzNS40NDc3IDEzNC42MzYgMzUgMTM0LjA4MyAzNVYzN1pNMTQyLjQxNyAzNUMxNDEuODY0IDM1IDE0MS40MTcgMzUuNDQ3NyAxNDEuNDE3IDM2QzE0MS40MTcgMzYuNTUyMyAxNDEuODY0IDM3IDE0Mi40MTcgMzdWMzVaTTE0Ni41ODMgMzdDMTQ3LjEzNiAzNyAxNDcuNTgzIDM2LjU1MjMgMTQ3LjU4MyAzNkMxNDcuNTgzIDM1LjQ0NzcgMTQ3LjEzNiAzNSAxNDYuNTgzIDM1VjM3Wk0xNTQuOTE3IDM1QzE1NC4zNjQgMzUgMTUzLjkxNyAzNS40NDc3IDE1My45MTcgMzZDMTUzLjkxNyAzNi41NTIzIDE1NC4zNjQgMzcgMTU0LjkxNyAzN1YzNVpNMTU3Ljc3NyAzNy4xMDE1QzE1OC4zMTEgMzcuMjQ0MSAxNTguODU5IDM2LjkyNzIgMTU5LjAwMiAzNi4zOTM2QzE1OS4xNDQgMzUuODYwMSAxNTguODI3IDM1LjMxMTkgMTU4LjI5NCAzNS4xNjkzTDE1Ny43NzcgMzcuMTAxNVpNMTYxLjgzMSAzOC43MDYxQzE2MS42ODggMzguMTcyNiAxNjEuMTQgMzcuODU1NiAxNjAuNjA2IDM3Ljk5ODNDMTYwLjA3MyAzOC4xNDA5IDE1OS43NTYgMzguNjg5IDE1OS44OTkgMzkuMjIyNkwxNjEuODMxIDM4LjcwNjFaTTE2MCA0Mi41QzE2MCA0My4wNTIzIDE2MC40NDggNDMuNSAxNjEgNDMuNUMxNjEuNTUyIDQzLjUgMTYyIDQzLjA1MjMgMTYyIDQyLjVIMTYwWk0xNjIgNTIuNUMxNjIgNTEuOTQ3NyAxNjEuNTUyIDUxLjUgMTYxIDUxLjVDMTYwLjQ0OCA1MS41IDE2MCA1MS45NDc3IDE2MCA1Mi41SDE2MlpNNzkgOTVWOTMuMTY2N0g3N1Y5NUg3OVpNNzkgODUuODMzM1Y4Mi4xNjY3SDc3Vjg1LjgzMzNINzlaTTc5IDc0LjgzMzNWNzEuMTY2N0g3N1Y3NC44MzMzSDc5Wk03OSA2My44MzMzVjYwLjE2NjdINzdWNjMuODMzM0g3OVpNNzkgNTIuODMzM1Y0OS4xNjY3SDc3VjUyLjgzMzNINzlaTTc5IDQxLjgzMzNWNDBINzdWNDEuODMzM0g3OVpNNzkgNDBDNzkgMzkuNzI5OCA3OS4wMzU1IDM5LjQ2OTQgNzkuMTAxNSAzOS4yMjI2TDc3LjE2OTMgMzguNzA2MUM3Ny4wNTg3IDM5LjExOTkgNzcgMzkuNTUzOSA3NyA0MEg3OVpNODEuMjIyNiAzNy4xMDE1QzgxLjQ2OTQgMzcuMDM1NSA4MS43Mjk4IDM3IDgyIDM3VjM1QzgxLjU1MzkgMzUgODEuMTE5OSAzNS4wNTg3IDgwLjcwNjEgMzUuMTY5M0w4MS4yMjI2IDM3LjEwMTVaTTgyIDM3SDg0LjA4MzNWMzVIODJWMzdaTTkyLjQxNjcgMzdIOTYuNTgzM1YzNUg5Mi40MTY3VjM3Wk0xMDQuOTE3IDM3SDEwOS4wODNWMzVIMTA0LjkxN1YzN1pNMTE3LjQxNyAzN0gxMjEuNTgzVjM1SDExNy40MTdWMzdaTTEyOS45MTcgMzdIMTM0LjA4M1YzNUgxMjkuOTE3VjM3Wk0xNDIuNDE3IDM3SDE0Ni41ODNWMzVIMTQyLjQxN1YzN1pNMTU0LjkxNyAzN0gxNTdWMzVIMTU0LjkxN1YzN1pNMTU3IDM3QzE1Ny4yNyAzNyAxNTcuNTMxIDM3LjAzNTUgMTU3Ljc3NyAzNy4xMDE1TDE1OC4yOTQgMzUuMTY5M0MxNTcuODggMzUuMDU4NyAxNTcuNDQ2IDM1IDE1NyAzNVYzN1pNMTU5Ljg5OSAzOS4yMjI2QzE1OS45NjUgMzkuNDY5NCAxNjAgMzkuNzI5OCAxNjAgNDBIMTYyQzE2MiAzOS41NTM5IDE2MS45NDEgMzkuMTE5OSAxNjEuODMxIDM4LjcwNjFMMTU5Ljg5OSAzOS4yMjI2Wk0xNjAgNDBWNDIuNUgxNjJWNDBIMTYwWk0xNjAgNTIuNVY1NUgxNjJWNTIuNUgxNjBaIiBmaWxsPSIjMDU1RkZDIi8+CjxwYXRoIGQ9Ik0yNDQuMTI1IDU0Ljc0MzRDMjQ0LjIwOSA1NC40MjI5IDI0NC4wMDQgNTQuMDk4MSAyNDMuNjY1IDU0LjAxOEMyNDMuMzI3IDUzLjkzNzkgMjQyLjk4NCA1NC4xMzI3IDI0Mi44OTkgNTQuNDUzM0wyNDAuMDQ4IDY1LjI1NjZDMjM5Ljk2MyA2NS41NzcxIDI0MC4xNjkgNjUuOTAxOSAyNDAuNTA3IDY1Ljk4MkMyNDAuODQ2IDY2LjA2MjEgMjQxLjE4OSA2NS44NjczIDI0MS4yNzMgNjUuNTQ2N0wyNDQuMTI1IDU0Ljc0MzRaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjM4LjIwNCA1NS42MjVMMjM0LjE4NSA1OS40MzE5QzIzMy45MzggNTkuNjY1NSAyMzMuOTM4IDYwLjA0NDMgMjM0LjE4NSA2MC4yNzc5TDIzOC4yMDQgNjQuMDg0OEMyMzguNDUxIDY0LjMxODQgMjM4Ljg1MSA2NC4zMTg0IDIzOS4wOTggNjQuMDg0OEMyMzkuMzQ0IDYzLjg1MTIgMjM5LjM0NCA2My40NzI1IDIzOS4wOTggNjMuMjM4OEwyMzUuNTI1IDU5Ljg1NDlMMjM5LjA5OCA1Ni40NzFDMjM5LjM0NCA1Ni4yMzc0IDIzOS4zNDQgNTUuODU4NiAyMzkuMDk4IDU1LjYyNUMyMzguODUxIDU1LjM5MTQgMjM4LjQ1MSA1NS4zOTE0IDIzOC4yMDQgNTUuNjI1WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTI0NS43OTYgNTUuNjI1TDI0OS44MTUgNTkuNDMxOUMyNTAuMDYyIDU5LjY2NTUgMjUwLjA2MiA2MC4wNDQzIDI0OS44MTUgNjAuMjc3OUwyNDUuNzk2IDY0LjA4NDhDMjQ1LjU0OSA2NC4zMTg0IDI0NS4xNDkgNjQuMzE4NCAyNDQuOTAyIDY0LjA4NDhDMjQ0LjY1NiA2My44NTEyIDI0NC42NTYgNjMuNDcyNSAyNDQuOTAyIDYzLjIzODhMMjQ4LjQ3NSA1OS44NTQ5TDI0NC45MDIgNTYuNDcxQzI0NC42NTYgNTYuMjM3NCAyNDQuNjU2IDU1Ljg1ODYgMjQ0LjkwMiA1NS42MjVDMjQ1LjE0OSA1NS4zOTE0IDI0NS41NDkgNTUuMzkxNCAyNDUuNzk2IDU1LjYyNVoiIGZpbGw9IndoaXRlIi8+CjxjaXJjbGUgY3g9Ijc4IiBjeT0iMTEwIiByPSIxNSIgZmlsbD0iI0Q4RTZGRiIgc3Ryb2tlPSIjOEJCM0ZBIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZD0iTTczIDEwN0M3My45MzE5IDEwNyA3NC43MTUgMTA2LjM2MyA3NC45MzcgMTA1LjVINzZDNzYuMjc2MSAxMDUuNSA3Ni41IDEwNS43MjQgNzYuNSAxMDZWMTE0Qzc2LjUgMTE0LjgyOCA3Ny4xNzE2IDExNS41IDc4IDExNS41SDgxLjA2M0M4MS4yODUgMTE2LjM2MyA4Mi4wNjgxIDExNyA4MyAxMTdDODQuMTA0NiAxMTcgODUgMTE2LjEwNSA4NSAxMTVDODUgMTEzLjg5NSA4NC4xMDQ2IDExMyA4MyAxMTNDODIuMDY4MSAxMTMgODEuMjg1IDExMy42MzcgODEuMDYzIDExNC41SDc4Qzc3LjcyMzkgMTE0LjUgNzcuNSAxMTQuMjc2IDc3LjUgMTE0VjEwOS40MTVDNzcuNjU2NCAxMDkuNDcgNzcuODI0NyAxMDkuNSA3OCAxMDkuNUg4MS4wNjNDODEuMjg1IDExMC4zNjMgODIuMDY4MSAxMTEgODMgMTExQzg0LjEwNDYgMTExIDg1IDExMC4xMDUgODUgMTA5Qzg1IDEwNy44OTUgODQuMTA0NiAxMDcgODMgMTA3QzgyLjA2ODEgMTA3IDgxLjI4NSAxMDcuNjM3IDgxLjA2MyAxMDguNUg3OEM3Ny43MjM5IDEwOC41IDc3LjUgMTA4LjI3NiA3Ny41IDEwOFYxMDZDNzcuNSAxMDUuMTcyIDc2LjgyODQgMTA0LjUgNzYgMTA0LjVINzQuOTM3Qzc0LjcxNSAxMDMuNjM3IDczLjkzMTkgMTAzIDczIDEwM0M3MS44OTU0IDEwMyA3MSAxMDMuODk1IDcxIDEwNUM3MSAxMDYuMTA1IDcxLjg5NTQgMTA3IDczIDEwN1oiIGZpbGw9IiMwNTVGRkMiLz4KPC9zdmc+Cg=="
              }
              alt="empty"
            />
            <div className={styles.title}>Nothing to show</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExplorerSidebarSettings(props: ExplorerSidebarProps) {
  const inputRef = useRef<TextInputRef>(null);
  const proxyCheckboxRef = useRef<CheckboxRef>(null);
  const historyCheckboxRef = useRef<CheckboxRef>(null);

  useEffect(() => {
    if (inputRef.current && inputRef.current.getValue() !== props.url) {
      inputRef.current.setValue(props.url);
    }
  }, [props.url]);

  useEffect(() => {
    if (
      proxyCheckboxRef.current &&
      proxyCheckboxRef.current.getValue() !== props.proxyEnabled
    ) {
      proxyCheckboxRef.current.setValue(props.proxyEnabled);
    }
  }, [props.proxyEnabled]);

  useEffect(() => {
    if (
      historyCheckboxRef.current &&
      historyCheckboxRef.current.getValue() !== props.historyEnabled
    ) {
      historyCheckboxRef.current.setValue(props.historyEnabled);
    }
  }, [props.historyEnabled]);

  return (
    <div className={styles.settings}>
      <div className={styles.title}>Settings</div>
      <div className={styles.divider} />
      <div className={styles.subtitle}>Connection</div>
      <div className={styles.item}>
        <TextInput
          ref={inputRef}
          placeholder="Enter GraphQL endpoint"
          defaultValue={props.url}
          onChange={(value) => {
            props.onUrlChange?.(value);
          }}
        />
        <div className={styles.actions}>
          {!import.meta.env.VITE_EXPLORER && (
            <div
              className={classNames("Link", styles.restore)}
              onClick={props.onUrlRestore}
            >
              <Icon icon={<IconRestore />} size={16} />
              Restore to default
            </div>
          )}
        </div>
      </div>
      <div className={styles.divider} />
      {props.hasProxy && (
        <>
          <div className={styles.subtitle}>Proxy</div>
          <div className={styles.item}>
            <div className={styles.checkbox}>
              <div className={styles.label}>
                Enabled
                <Tooltip text="Enabling proxy, sends operation's request and headers via Inigo's proxy server. This is often needed to allow the server to respond.">
                  <Icon icon={<IconInfo />} size={16} className={styles.info} />
                </Tooltip>
              </div>
              <Checkbox
                ref={proxyCheckboxRef}
                // label="Enabled"
                variant={CheckboxVariant.Switch}
                defaultValue={props.proxyEnabled}
                onChange={(value) => {
                  props.onProxyEnabledChange?.(value);
                }}
                disabled={props.url.includes("localhost")}
              />
            </div>
          </div>
          <div className={styles.divider} />
        </>
      )}
      <div className={styles.subtitle}>History</div>
      <div className={styles.item}>
        <div className={styles.checkbox}>
          <div className={styles.label}>Enabled</div>
          <Checkbox
            ref={historyCheckboxRef}
            // label="Enabled"
            variant={CheckboxVariant.Switch}
            defaultValue={props.historyEnabled}
            onChange={(value) => {
              props.onHistoryEnabledChange?.(value);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ExplorerSidebarCollections(
  props: ExplorerSidebarProps & { shared?: boolean }
) {
  const deleteModalRef = useRef<any>(null);
  const [collectionToDelete, setCollectionToDelete] =
    useState<ExplorerCollection | null>(null);
  const [collectionOperationToDelete, setCollectionOperationToDelete] =
    useState<ExplorerCollectionOperation | null>(null);
  const [collapsedCollections, setCollapsedCollections] = useState<string[]>(
    []
  );
  const [editCollection, setEditCollection] = useState<string | null>(null);
  const editNameInputRef = useRef<HTMLInputElement>(null);

  const onCollectionDeleteClick = useCallback(
    (collection: ExplorerCollection) => {
      setCollectionToDelete(collection);
      setCollectionOperationToDelete(null);

      deleteModalRef.current?.open();
    },
    [deleteModalRef]
  );

  const onCollectionOperationDeleteClick = useCallback(
    (operation: ExplorerCollectionOperation) => {
      setCollectionToDelete(null);
      setCollectionOperationToDelete(operation);

      deleteModalRef.current?.open();
    },
    [deleteModalRef]
  );

  const onCollectionNameUpdate = useCallback(() => {
    props.onCollectionsUpdate?.((prev) => {
      const collectionIndex = prev.findIndex(
        (item) => item.id === editCollection
      );

      if (collectionIndex === -1) {
        return prev;
      }

      if (
        prev.some(
          (item) =>
            item.name === editNameInputRef.current?.value &&
            item.id !== editCollection
        )
      ) {
        message({
          type: MessageType.Error,
          text: "Collection with this name already exists",
        });

        return prev;
      }

      const result = [...prev];

      result[collectionIndex].name = editNameInputRef.current?.value || "";

      setEditCollection(null);

      return result;
    });
  }, [editCollection]);

  const onCollectionOperationClick = useCallback(
    (
      collection: ExplorerCollection,
      operation: ExplorerCollectionOperation
    ) => {
      const tab = props.tabs.find(
        (tab) =>
          tab.collectionId === collection.id &&
          tab.collectionName === operation.name
      );

      if (tab) {
        props.onTabActivate?.(tab.id);
        return;
      }

      const tabId = guuid();

      props.onTabCreate?.({
        id: tabId,
        collectionId: collection.id,
        collectionName: operation.name,
        query: operation.query,
        variables: operation.variables,
      });

      props.onTabActivate?.(tabId);
    },
    [props.tabs, props.onTabCreate]
  );

  const onDelete = useCallback(() => {
    if (collectionToDelete) {
      props.onCollectionsUpdate?.((prev) =>
        prev.filter((item) => item.id !== collectionToDelete.id)
      );

      message({
        type: MessageType.Success,
        text: `Collection "${collectionToDelete.name}" has been deleted`,
      });
    }

    if (collectionOperationToDelete) {
      props.onCollectionsUpdate?.((prev) => {
        const collectionIndex = prev.findIndex((item) =>
          item.operations.includes(collectionOperationToDelete!)
        );

        if (collectionIndex === -1) {
          return prev;
        }

        const result = [...prev];

        result[collectionIndex].operations = result[
          collectionIndex
        ].operations.filter(
          (operation) => operation.name !== collectionOperationToDelete?.name
        );

        return result;
      });

      message({
        type: MessageType.Success,
        text: `Operation "${collectionOperationToDelete.name}" has been deleted from collection`,
      });
    }

    setCollectionToDelete(null);
    setCollectionOperationToDelete(null);
    deleteModalRef.current?.close();
  }, [collectionToDelete, collectionOperationToDelete, deleteModalRef]);

  const toggleCollection = useCallback(
    (collectionId: string) => {
      setCollapsedCollections((prev) => {
        if (prev.includes(collectionId)) {
          return prev.filter((item) => item !== collectionId);
        }

        return [...prev, collectionId];
      });
    },
    [setCollapsedCollections]
  );

  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div
      className={classNames(
        styles.collections,
        props.shared && styles.shared,
        props.access === "admin" && styles.admin
      )}
    >
      <Modal
        ref={deleteModalRef}
        className={styles.deleteModalContainer}
        options={{ borderTopColor: "#FFC836" }}
      >
        <div className={styles.deleteModal}>
          <div className={styles.modalHeader}>
            <div className={styles.modalIcon}>
              <Icon size={32} icon={<IconWarningFilled />} />
            </div>
            <h2 className={styles.modalTitle}>Warning</h2>
          </div>
          <div className={styles.modalContent}>
            {collectionToDelete && (
              <p className={styles.modalText}>
                Are you sure you want to delete "{collectionToDelete.name}"
                collection?
              </p>
            )}
            {collectionOperationToDelete && (
              <p className={styles.modalText}>
                Are you sure you want to delete "
                {collectionOperationToDelete.name}" operation?
              </p>
            )}
          </div>
          <div className={styles.modalActions}>
            <Button
              label="Cancel"
              type="link"
              onClick={() => deleteModalRef.current?.close()}
            />
            <Button label="Delete" onClick={onDelete} />
          </div>
        </div>
      </Modal>
      <div
        className={classNames(styles.label, !isExpanded && styles.collapsed)}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <Icon className={styles.arrow} icon={<ArrowDown />} size={12} />
        <Icon
          icon={!props.shared ? <IconLocked /> : <IconUnlocked />}
          size={16}
        />
        <span>
          {props.shared ? "Shared" : "Personal"} ({props.collections.length})
        </span>
      </div>
      {isExpanded && (
        <div className={styles.collectionsList}>
          {!!props.collections.length &&
            props.collections.map((collection) => (
              <div
                className={classNames(
                  styles.collection,
                  collapsedCollections.includes(collection.id) &&
                    styles.collapsed
                )}
              >
                {editCollection === collection.id ? (
                  <div className={styles.editName}>
                    <Icon
                      className={styles.arrow}
                      icon={<ArrowDown />}
                      size={12}
                    />
                    <Icon icon={<IconFolder />} size={16} />
                    <input
                      className={classNames(styles.input)}
                      ref={editNameInputRef}
                      type="text"
                      autoFocus
                      defaultValue={collection.name}
                    />
                    <div
                      className={styles.button}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        onCollectionNameUpdate();
                      }}
                    >
                      <Tooltip
                        text="Save"
                        position={TooltipPosition.Bottom}
                        popupStyle={{ padding: "var(--gutter-extra-small)" }}
                      >
                        <Icon
                          className={styles.edit}
                          icon={<Check />}
                          size={16}
                        />
                      </Tooltip>
                    </div>
                    <div
                      className={styles.button}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        setEditCollection(null);
                      }}
                    >
                      <Tooltip
                        text="Discard"
                        position={TooltipPosition.Bottom}
                        popupStyle={{ padding: "var(--gutter-extra-small)" }}
                      >
                        <Icon
                          className={styles.delete}
                          icon={<Close />}
                          size={16}
                        />
                      </Tooltip>
                    </div>
                  </div>
                ) : (
                  <div
                    className={styles.name}
                    onClick={() => toggleCollection(collection.id)}
                  >
                    <Icon
                      className={styles.arrow}
                      icon={<ArrowDown />}
                      size={12}
                    />
                    <Icon icon={<IconFolder />} size={16} />
                    <div className={styles.text}>
                      <Tooltip
                        truncated
                        text={collection.name}
                        popupStyle={{ padding: "var(--gutter-extra-small)" }}
                        position={TooltipPosition.Bottom}
                      >
                        {collection.name}
                      </Tooltip>
                    </div>
                    {props.access === "admin" ? (
                      props.shared ? (
                        <div className={styles.button}>
                          <PopConfirm
                            icon={<Icon icon={<IconWarning />} size={16} />}
                            title="Make personal"
                            text={`Do you want to make '${collection.name}' personal?`}
                            onConfirm={() => {
                              props.onCollectionsUpdate?.((prev) =>
                                prev.filter((item) => item.id !== collection.id)
                              );

                              props.onSharedCollectionsUpdate?.((prev) => {
                                return [
                                  ...prev,
                                  {
                                    ...collection,
                                    id: guuid(),
                                  },
                                ];
                              });
                            }}
                          >
                            <Icon
                              className={styles.edit}
                              icon={<IconUnlocked />}
                              size={16}
                            />
                          </PopConfirm>
                        </div>
                      ) : (
                        <div className={styles.button}>
                          <PopConfirm
                            icon={<Icon icon={<IconWarning />} size={16} />}
                            title="Make shared"
                            text={`Do you want to make '${collection.name}' shared?`}
                            onConfirm={() => {
                              props.onCollectionsUpdate?.((prev) =>
                                prev.filter((item) => item.id !== collection.id)
                              );

                              props.onSharedCollectionsUpdate?.((prev) => {
                                return [
                                  ...prev,
                                  {
                                    ...collection,
                                    id: guuid(),
                                  },
                                ];
                              });
                            }}
                          >
                            <Icon
                              className={styles.edit}
                              icon={<IconLocked />}
                              size={16}
                            />
                          </PopConfirm>
                        </div>
                      )
                    ) : null}
                    {(!props.shared || props.access === "admin") && (
                      <>
                        <div
                          className={styles.button}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            setEditCollection(collection.id);
                          }}
                        >
                          <Tooltip
                            text="Edit"
                            position={TooltipPosition.Bottom}
                            popupStyle={{
                              padding: "var(--gutter-extra-small)",
                            }}
                          >
                            <Icon
                              className={styles.edit}
                              icon={<IconEdit />}
                              size={16}
                            />
                          </Tooltip>
                        </div>
                        <div
                          className={styles.button}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            onCollectionDeleteClick(collection);
                          }}
                        >
                          <Tooltip
                            text="Delete"
                            position={TooltipPosition.Bottom}
                            popupStyle={{
                              padding: "var(--gutter-extra-small)",
                            }}
                          >
                            <Icon
                              className={styles.delete}
                              icon={<Trash />}
                              size={16}
                            />
                          </Tooltip>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className={styles.inner}>
                  <div className={styles.operations}>
                    {collection.operations?.length ? (
                      collection.operations
                        // .filter((operation) => operation.name)
                        .map((operation) => (
                          <div
                            className={styles.query}
                            onClick={() =>
                              onCollectionOperationClick(collection, operation)
                            }
                          >
                            <div className={styles.name}>
                              <Tooltip
                                truncated
                                text={operation.name}
                                popupStyle={{
                                  padding: "var(--gutter-extra-small)",
                                }}
                              >
                                {operation.name}
                              </Tooltip>
                            </div>
                            {(!props.shared || props.access === "admin") && (
                              <div
                                className={styles.button}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();

                                  onCollectionOperationDeleteClick(operation);
                                }}
                              >
                                <Tooltip
                                  text="Delete operation from collection"
                                  popupStyle={{
                                    padding: "var(--gutter-extra-small)",
                                  }}
                                >
                                  <Icon
                                    className={styles.delete}
                                    icon={<Trash />}
                                    size={16}
                                  />
                                </Tooltip>
                              </div>
                            )}
                          </div>
                        ))
                    ) : (
                      <div className={styles.empty}>
                        No operations in this collection
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function ExplorerSidebarCollectionsWrapper(props: ExplorerSidebarProps) {
  const formRef = useRef<FormRef>(null);
  const modalRef = useRef<any>(null);

  const onCollectionCreateHandler = useCallback(
    (closeModal: () => void) => {
      if (formRef.current) {
        if (formRef.current.validate()) {
          const formValue = formRef.current.getValue();
          const name = formValue.name as string;

          if (
            (formValue.shared
              ? props.sharedCollections
              : props.collections
            ).some((collection) => collection.name === name)
          ) {
            formRef.current.setError({
              name: "Collection with this name already exists",
            });
            return;
          }

          if (formValue.shared) {
            props.onSharedCollectionCreate?.({
              id: guuid(),
              name,
              operations: [],
            });
          } else {
            props.onCollectionCreate?.({ id: guuid(), name, operations: [] });
          }
          closeModal();
        }
      }
    },
    [
      formRef,
      props.onCollectionCreate,
      props.collections,
      props.sharedCollections,
      props.onSharedCollectionCreate,
    ]
  );

  return (
    <div className={styles.collectionsWrapper}>
      <Modal
        ref={modalRef}
        options={{
          title: "Create collection",
          buttons: [
            {
              label: "Cancel",
              tertiary: true,
              handler: (close) => close(),
            },
            {
              label: "Create",
              handler: (close) => onCollectionCreateHandler(close),
            },
          ],
        }}
      >
        <Form
          ref={formRef}
          containerStyle={{ width: "100%" }}
          style={{ gridTemplateColumns: "1fr" }}
          onSubmit={() => onCollectionCreateHandler(modalRef.current.close)}
        >
          <TextInput
            name="name"
            label="Name"
            required
            style={{ width: "100%" }}
          />
          {props.access === "admin" && (
            <Checkbox name="shared" style={{ width: "100%" }}>
              Make collection shared
            </Checkbox>
          )}
        </Form>
      </Modal>

      <div className={styles.title}>
        Collections
        <Button
          className={styles.createCollection}
          icon={<AddCircle />}
          type="link"
          label="Create"
          onClick={() => {
            formRef.current?.clear();
            formRef.current?.setError({});
            formRef.current?.focus?.();
            modalRef.current?.open();
          }}
        />
      </div>
      <div className={styles.divider} />
      <div className={styles.grid}>
        <ExplorerSidebarCollections {...props} />
        <div className={styles.divider} />
        {!import.meta.env.VITE_EXPLORER && (
          <ExplorerSidebarCollections
            {...props}
            shared
            collections={props.sharedCollections}
            onCollectionCreate={props.onSharedCollectionCreate}
            onCollectionsUpdate={props.onSharedCollectionsUpdate}
            onSharedCollectionCreate={props.onCollectionCreate}
            onSharedCollectionsUpdate={props.onCollectionsUpdate}
          />
        )}
      </div>
    </div>
  );
}

export default function ExplorerSidebar(props: ExplorerSidebarProps) {
  const [activeTab, setActiveTab] = useState<ExplorerSidebarTabs>(
    (getQueryParamByName("sidebarTab") as ExplorerSidebarTabs) ||
      ExplorerSidebarTabs.Docs
  );

  useEffect(() => {
    updateQueryParamByName("sidebarTab", activeTab);
  }, [activeTab]);

  return (
    <div className={classNames(styles.sidebar)}>
      <div className={styles.navigation}>
        <div className={styles.tabs}>
          {Object.values(ExplorerSidebarTabs).map((value) => {
            return (
              <Tooltip
                text={EXPLORER_SIDEBAR_TABS_LABEL_MAP[value]}
                popupStyle={{ padding: "var(--gutter-extra-small)" }}
                position={TooltipPosition.Bottom}
              >
                <div
                  className={classNames(
                    styles.tab,
                    activeTab === value && styles.active
                  )}
                  onClick={() => setActiveTab(value)}
                >
                  <Icon
                    icon={EXPLORER_SIDEBAR_TABS_ICONS_MAP[value]}
                    size={16}
                  />
                </div>
              </Tooltip>
            );
          })}
        </div>
        <a
          href="https://docs.inigo.io/product/explorer"
          target="_blank"
          rel="noreferrer"
          style={{ marginLeft: "auto" }}
        >
          <Button
            label="Docs"
            type="link"
            icon={<IconLink />}
            iconPosition="right"
          />
        </a>
      </div>
      <div className={classNames(styles.content, styles.card)}>
        {activeTab === ExplorerSidebarTabs.Docs && (
          <ExplorerSidebarDocs {...props} />
        )}
        {activeTab === ExplorerSidebarTabs.Collections && (
          <ExplorerSidebarCollectionsWrapper {...props} />
        )}
        {activeTab === ExplorerSidebarTabs.History && (
          <ExplorerSidebarHistory {...props} />
        )}
        {activeTab === ExplorerSidebarTabs.Settings && (
          <ExplorerSidebarSettings {...props} />
        )}
      </div>
    </div>
  );
}

import classNames from "classnames";
import {
  getOperationAST,
  IntrospectionInputObjectType,
  IntrospectionInputTypeRef,
  IntrospectionQuery,
  OperationDefinitionNode,
  parse,
  TypeNode,
} from "graphql";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import Button from "../../../components/Button/Button";
import Checkbox from "../../../components/Checkbox/Checkbox";
import { CheckboxVariant } from "../../../components/Checkbox/Checkbox.types";
import { ICodeEditorRef } from "../../../components/code-editor/code-editor.types";
import {
  IconCollections,
  IconPlay,
  IconShare,
  More,
  StopOutlined,
} from "../../../components/Icon/Icon";
import Menu, { Option } from "../../../components/Menu/Menu";
import { MessageType } from "../../../components/MessagesWrapper/MessagesWrapper.types";
import { message } from "../../../components/MessagesWrapper/MessagesWrapper.utils";
import TabView, { Tab } from "../../../components/TabView/TabView";
import CodeEditor from "../../../components/code-editor";
import { ExplorerTab } from "../../Explorer";
import localPreferences from "../../../utils/localPreferences";
import styles from "./Request.module.css";

export interface RequestProps {
  tab: ExplorerTab;
  headers: string;
  url: string;
  proxyEnabled: boolean;
  schema?: IntrospectionQuery;
  onQuery?: (operationName?: string) => void;
  onHeadersUpdate?: (headers: string) => void;
  onTabUpdate?: (update: (prev: ExplorerTab) => ExplorerTab) => void;
  onSaveToCollection?: () => void;
  onSaveToSharedCollection?: () => void;
  preflightEnabled?: boolean;
  onPreflightEnabledChange?: (value: boolean) => void;
  onPreflightModalOpen?: () => void;
  onEnvVariablesModalOpen?: () => void;
  onSelectedOperationNameChange?: (operationName?: string) => void;
  onCursorPositionChange?: (position: {
    lineNumber: number;
    column: number;
  }) => void;
  isSubscriptionActive: boolean;
  terminateSubscription: (() => void) | null;
  theme?: "light" | "dark";
}

function getJsonSchemaVariableDefinition(
  definition: TypeNode | IntrospectionInputTypeRef,
  inputs: IntrospectionInputObjectType[]
): any {
  if (definition.kind === "NonNullType") {
    return {
      ...getJsonSchemaVariableDefinition(definition.type, inputs),
      required: true,
    };
  }

  if (definition.kind === "ListType") {
    return {
      type: "array",
      items: getJsonSchemaVariableDefinition(definition.type, inputs),
    };
  }

  if (definition.kind === "NamedType" || definition.kind === "SCALAR") {
    const name =
      definition.kind === "NamedType" ? definition.name.value : definition.name;

    switch (name) {
      case "String":
        return {
          type: "string",
        };
      case "Int":
        return {
          type: "number",
        };
      case "Float":
        return {
          type: "number",
        };
      case "Boolean":
        return {
          type: "boolean",
        };
      case "ID":
        return {
          type: "string",
        };
      default:
        const input = inputs.find((input) => input.name === name);

        if (input) {
          return {
            type: "object",
            properties: Object.fromEntries(
              input.inputFields.map((inputField) => {
                return [
                  inputField.name,
                  getJsonSchemaVariableDefinition(inputField.type, inputs),
                ];
              })
            ),
          };
        }

        return {
          type: "string",
        };
    }
  }

  return {
    type: "string",
  };
}

function getJsonSchemaVariablesFromQuery(
  doc?: ReturnType<typeof parse>,
  inputs: IntrospectionInputObjectType[] = []
) {
  if (!doc) {
    return {};
  }

  const operation = getOperationAST(doc, undefined);

  if (!operation) {
    return {};
  }

  const variableDefinitions = operation.variableDefinitions;

  if (!variableDefinitions) {
    return {};
  }

  return {
    type: "object",
    properties: Object.fromEntries(
      variableDefinitions.map((variableDefinition) => [
        variableDefinition.variable.name?.value,
        getJsonSchemaVariableDefinition(variableDefinition.type, inputs),
      ])
    ),
  };
}

export interface RequestRef {
  focusQueryEditor: (cursorPosition?: {
    lineNumber: number;
    column: number;
  }) => void;
}

// million-ignore
const ExplorerRequest: React.ForwardRefRenderFunction<
  RequestRef,
  RequestProps
> = (props: RequestProps, ref) => {
  const queryEditorRef = useRef<ICodeEditorRef>(null);
  const variablesEditorRef = useRef<ICodeEditorRef>(null);
  const extensionsEditorRef = useRef<ICodeEditorRef>(null);
  const headersEditorRef = useRef<ICodeEditorRef>(null);

  useImperativeHandle(
    ref,
    () => ({
      focusQueryEditor: (cursorPosition) => {
        queryEditorRef.current?.focus(cursorPosition);
      },
    }),
    []
  );

  const operationNames = useMemo(() => {
    if (!props.tab.doc) {
      return [];
    }

    return props.tab.doc.definitions
      .filter((definition: any) => definition.kind === "OperationDefinition")
      .map((definition: any) => (definition as OperationDefinitionNode).name)
      .filter((operationName: any) => !!operationName);
  }, [props.tab]);

  const closestOperation = useCallback(() => {
    try {
      if (queryEditorRef.current) {
        const cursorPosition = queryEditorRef.current.getPosition();

        if (cursorPosition) {
          const currentQuery = queryEditorRef.current.getValue();

          if (currentQuery) {
            const ast = parse(currentQuery);

            if (ast) {
              const operation = ast.definitions.find((definition) => {
                if (definition.kind !== "OperationDefinition") {
                  return false;
                }

                if (!definition.loc) {
                  return false;
                }

                return (
                  definition.loc.startToken.line <= cursorPosition.lineNumber &&
                  definition.loc.endToken.line >= cursorPosition.lineNumber
                );
              });

              if (operation) {
                return operation as OperationDefinitionNode;
              }
            }
          }
        }
      }
    } catch (err) {}
  }, [queryEditorRef]);

  const variablesJsonSchema = useMemo(() => {
    if (!props.tab?.doc) {
      return {};
    }

    return getJsonSchemaVariablesFromQuery(
      props.tab.doc,
      props.schema?.__schema?.types.filter(
        (type) => type.kind === "INPUT_OBJECT"
      ) as IntrospectionInputObjectType[]
    );
  }, [props.tab.query, props.schema, getJsonSchemaVariablesFromQuery]);

  useEffect(() => {
    if (queryEditorRef.current) {
      const newValue = props.tab.query || "";
      const currentValue = queryEditorRef.current.getValue();

      if (newValue !== currentValue) {
        queryEditorRef.current.setValue(newValue);
      }
    }
  }, [props.tab.query]);

  useEffect(() => {
    setTimeout(() => {
      if (variablesEditorRef.current) {
        const newValue = props.tab.variables || "";
        const currentValue = variablesEditorRef.current.getValue();

        if (newValue !== currentValue) {
          variablesEditorRef.current.setValue(newValue);
        }
      }
    }, 0);
  }, [props.tab.variables]);

  useEffect(() => {
    setTimeout(() => {
      if (extensionsEditorRef.current) {
        const newValue = props.tab.extensions || "";
        const currentValue = extensionsEditorRef.current.getValue();

        if (newValue !== currentValue) {
          extensionsEditorRef.current.setValue(newValue);
        }
      }
    }, 0);
  }, [props.tab.extensions]);

  useEffect(() => {
    setTimeout(() => {
      if (headersEditorRef.current) {
        const newValue = props.headers || "";
        const currentValue = headersEditorRef.current.getValue();
        if (newValue !== currentValue) {
          headersEditorRef.current.setValue(newValue);
        }
      }
    }, 0);
  }, [props.headers]);

  const onQuery = useCallback(
    (operationName?: string, count = 1) => {
      if (props.onQuery) {
        for (let i = 0; i < count; i++) {
          props.onQuery(operationName);
        }
      }
    },
    [props.onQuery]
  );

  const operationToRun = useCallback(() => {
    return (
      closestOperation()?.name?.value ?? operationNames?.[0]?.value ?? undefined
    );
  }, [operationNames, closestOperation]);

  const copyShareableLink = useCallback(
    (options?: { variables?: boolean; extensions?: true; headers?: true }) => {
      const query = new URLSearchParams(window.location.search);

      query.delete("sidebarTab");
      query.delete("otherTabs");
      query.delete("responseTab");

      if (props.tab.query) {
        query.set("query", props.tab.query);
      }

      if (options?.headers && props.headers) {
        query.set("headers", props.headers);
      }

      if (options?.extensions && props.tab.extensions) {
        query.set("extensions", props.tab.extensions);
      }

      if (options?.variables && props.tab.variables) {
        query.set("variables", props.tab.variables);
      }

      if (props.url) {
        query.set("endpoint", props.url);
      }

      if (props.proxyEnabled) {
        query.set("proxyEnabled", "true");
      }

      navigator.clipboard.writeText(
        `${window.location.origin}${
          window.location.pathname
        }?${query.toString()}`
      );

      message({
        type: MessageType.Success,
        text: "Link copied to clipboard",
      });
    },
    [props.tab, props.headers, props.url, props.proxyEnabled]
  );

  const [layout, setLayout] = useState<[number, number]>(
    localPreferences.get("explorer").layout?.request ?? [65, 35]
  );

  useEffect(() => {
    localPreferences.set("explorer", {
      ...localPreferences.get("explorer"),
      layout: {
        ...localPreferences.get("explorer").layout,
        request: layout,
      },
    });
  }, [layout]);

  const containerRef = useRef<HTMLDivElement>(null);
  const handleIsDragging = useRef<boolean>();
  const lastCursorPositionY = useRef<number>();

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    document.body.classList.add("dragging");
    handleIsDragging.current = true;
    lastCursorPositionY.current = e.clientY;
  }, []);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (handleIsDragging.current) {
        const height = containerRef.current?.offsetHeight || 0;
        const newLayout: [number, number] = [...layout];

        newLayout[0] +=
          ((e.clientY - lastCursorPositionY.current!) / height) * 100;
        newLayout[1] -=
          ((e.clientY - lastCursorPositionY.current!) / height) * 100;

        lastCursorPositionY.current = e.clientY;

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

  return (
    <div
      className={styles.request}
      ref={containerRef}
      style={{
        gridTemplateRows: `minmax(100px, calc(${layout[0]}% - 8px)) 16px minmax(100px, calc(${layout[1]}% - 8px))`,
      }}
    >
      <div className={classNames(styles.query, styles.card)}>
        <div className={styles.toolbar}>
          <div className={styles.title}>Query</div>
          <div className={styles.copy}>
            <Button
              className={styles.main}
              icon={<IconShare />}
              type="border"
              label="Share"
              onClick={() => copyShareableLink()}
            />
            <Menu
              target={
                <Button className={styles.more} type="border" icon={<More />} />
              }
              placement="right"
              minWidth={125}
              onSelect={(opts: any) => copyShareableLink(opts)}
            >
              <Option value={{ variables: true }}>Copy with variables</Option>
              <Option value={{ variables: true, extensions: true }}>
                Copy with variables and extensions
              </Option>
              <Option
                value={{ variables: true, extensions: true, headers: true }}
              >
                Copy with variables, extensions and headers
              </Option>
            </Menu>
          </div>
          <Button
            label="Save"
            type="border"
            icon={<IconCollections />}
            onClick={props.onSaveToCollection}
          />
          {props.isSubscriptionActive ? (
            <div className={styles.run}>
              <Button
                className={styles.main}
                icon={<StopOutlined />}
                label="Stop"
                onClick={() => props.terminateSubscription?.()}
              />
              <Button disabled={true} className={styles.more} icon={<More />} />
            </div>
          ) : (
            <div className={styles.run}>
              <Button
                className={styles.main}
                icon={<IconPlay />}
                label="Run"
                onClick={() => onQuery(operationToRun())}
              />
              <Menu
                target={<Button className={styles.more} icon={<More />} />}
                placement="right"
                minWidth={125}
                onSelect={(countValue) =>
                  onQuery(operationToRun(), countValue as number)
                }
              >
                <Option value={10}>Run 10x</Option>
              </Menu>
            </div>
          )}
        </div>
        <div className={styles.divider} />
        <CodeEditor
          padding={0}
          ref={queryEditorRef}
          className={styles.editor}
          defaultLanguage="graphql"
          graphQLSchema={props.schema}
          defaultValue={props.tab.query || ""}
          onChange={(value) => {
            props.onTabUpdate?.((prev) => ({
              ...prev,
              query: value,
            }));
          }}
          onCursorPositionChange={(position) => {
            props.onSelectedOperationNameChange?.(operationToRun());
            props.onCursorPositionChange?.(position);
          }}
          theme={props.theme}
        />
      </div>
      <div className={styles.handle} onMouseDown={onMouseDown} />
      <div className={classNames(styles.other, styles.card)}>
        <TabView
          queryParamName="otherTabs"
          actions={
            <div className={styles.globalActions}>
              <Checkbox
                variant={CheckboxVariant.Switch}
                defaultValue={props.preflightEnabled}
                onChange={(value) => props.onPreflightEnabledChange?.(value)}
              />
              <Button
                label="Preflight script"
                type="link"
                onClick={props.onPreflightModalOpen}
              />
              <Button
                label="Environment variables"
                type="link"
                onClick={props.onEnvVariablesModalOpen}
              />
            </div>
          }
        >
          <Tab label="Variables" path="variables">
            <CodeEditor
              key="variables"
              padding={0}
              ref={variablesEditorRef}
              className={styles.editor}
              defaultLanguage="json"
              jsonSchema={variablesJsonSchema}
              defaultValue={props.tab.variables || ""}
              onChange={(value) =>
                props.onTabUpdate?.((prev) => ({ ...prev, variables: value }))
              }
              theme={props.theme}
            />
          </Tab>
          <Tab label="Extensions" path="extensions">
            <CodeEditor
              key="extensions"
              padding={0}
              ref={extensionsEditorRef}
              className={styles.editor}
              defaultLanguage="json"
              defaultValue={props.tab.extensions || ""}
              onChange={(value) =>
                props.onTabUpdate?.((prev) => ({ ...prev, extensions: value }))
              }
              theme={props.theme}
            />
          </Tab>
          <Tab label="Headers" path="headers">
            <CodeEditor
              key="headers"
              padding={0}
              ref={headersEditorRef}
              className={styles.editor}
              defaultLanguage="json"
              defaultValue={props.headers}
              onChange={(value) => props.onHeadersUpdate?.(value)}
              theme={props.theme}
            />
          </Tab>
        </TabView>
      </div>
    </div>
  );
};

export default forwardRef(ExplorerRequest);

import styles from "./code-editor.module.css";
import classNames from "classnames";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as monaco from "monaco-editor";
import {
  IntrospectionQuery,
  ObjectTypeDefinitionNode,
  getOperationAST,
  parse,
  visit,
} from "graphql";
// @ts-ignore
import { initializeMode } from "monaco-graphql/esm/initializeMode";
import { ICodeEditorProps, ICodeEditorRef } from "./code-editor.types";
import { debounce, uniqueId } from "lodash";
// @ts-ignore
import { MonacoGraphQLAPI } from "monaco-graphql/esm/api";
// @ts-ignore
import { StandaloneCodeEditorServiceImpl } from "monaco-editor/esm/vs/editor/standalone/browser/StandaloneCodeEditorServiceImpl.js";
import { updateQueryParams } from "../../utils/queryParams";

(window as any).monaco = monaco;

monaco.editor.defineTheme("inigo-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#1f1f1f",
  },
});

monaco.editor.defineTheme("inigo", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#f6f8fa",
  },
});

interface Coordinates {
  lineStart: number;
  lineEnd: number;
  colStart: number;
  colEnd: number;
}

const findPropertyPathInAST = (
  query: string,
  coords: Coordinates
): string | null => {
  const ast = parse(query);
  let path2: string[] = [];
  let foundProperty: boolean = false;

  const isWithinCoordinates = (start: any) => {
    return (
      start.line === coords.lineStart
      // start.column <= coords.colStart &&
      // end.column >= coords.colEnd
    );
  };

  visit(ast, {
    enter(node) {
      if (foundProperty) {
        return false;
      }

      if (node.loc && node.loc.startToken && node.loc.endToken) {
        if (node.kind === "Field") {
          path2.push(node.name.value);

          if (isWithinCoordinates(node.loc.startToken)) {
            foundProperty = true;
          }
        }
      }
    },
    leave(node) {
      if (foundProperty) {
        return false;
      }

      if (node.kind === "Field") {
        path2.pop();
      }
    },
  });

  let prefix = "query";

  const operation = getOperationAST(ast);

  if (operation?.operation) {
    prefix = operation.operation;
  }

  return foundProperty ? `${prefix}.${path2.join(".")}` : null;
};

const findTypeByPath = (path?: string, schema?: any) => {
  try {
    if (!path || !schema) {
      return null;
    }

    let result: any = null;
    const pathParts = path.split(".");

    for (let i = 0; i < pathParts.length - 1; i++) {
      if (i === 0) {
        result = schema.doc.Schema.Operations[pathParts[i]];
      } else {
        // result = getTypeName(
        //   schema.doc.Types[result].Fields[pathParts[i]].Type
        // );
      }
    }

    return result;
  } catch (e) {
    console.warn("Error finding type by path", e);
    return null;
  }
};

function findDefinitionInSchema(schema: any, type: string) {
  const schemaAST = parse(schema);
  let definition: any = null;

  visit(schemaAST, {
    enter(node) {
      if (node.kind === "ObjectTypeDefinition" && node.name.value === type) {
        definition = node;
      }
    },
  });

  return definition;
}

class GraphQLDefinitionProvider implements monaco.languages.DefinitionProvider {
  constructor(
    private readonly schema: ICodeEditorProps["schema"],
    private readonly schemaModel: monaco.editor.ITextModel
  ) {}

  provideDefinition(
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ) {
    const word = model.getWordAtPosition(position);

    if (!word) {
      return;
    }

    if (!this.schemaModel) {
      return;
    }

    if (this.schemaModel.isDisposed()) {
      return;
    }

    const schema = this.schemaModel.getValue();

    if (!schema) {
      return;
    }

    const path = findPropertyPathInAST(model.getValue(), {
      lineStart: position.lineNumber,
      lineEnd: position.lineNumber,
      colStart: word.startColumn,
      colEnd: word.endColumn,
    });

    if (!path) {
      return;
    }

    const schemaPath = findTypeByPath(path, this.schema);

    if (!schemaPath) {
      return;
    }

    const definition = findDefinitionInSchema(
      schema,
      schemaPath
    ) as ObjectTypeDefinitionNode;

    if (!definition || !definition.loc) {
      return null;
    }

    return {
      range: {
        startLineNumber: definition.loc.startToken.line,
        startColumn: definition.loc.startToken.column,
        endLineNumber: definition.loc.endToken.line,
        endColumn: definition.loc.endToken.column,
      },
      uri: this.schemaModel.uri,
    };
  }
}

const CodeEditor: React.ForwardRefRenderFunction<
  ICodeEditorRef,
  ICodeEditorProps
> = (props, ref) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState<monaco.editor.ITextModel | null>(null);
  const [editor, setEditor] =
    useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const apiRef = useRef<MonacoGraphQLAPI | null>(null);
  const editorRef = useRef(editor);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (wrapperRef.current) {
      const id = uniqueId();

      let fileName = `${id}.${props.defaultLanguage}`;
      let libName = `${id}.${props.defaultLanguage}`;

      if (props.defaultLanguage === "javascript") {
        fileName = `${id}.ts`;
        libName = `ts:filename/${id}.d.ts`;
      }

      if (props.jsonSchema) {
        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
          schemas: [
            {
              uri: "http://myserver/foo-schema.json",
              fileMatch: [fileName],
              schema: props.jsonSchema,
            },
          ],
          schemaValidation: "warning",
        });
      }

      if (props.extraLib) {
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          target: monaco.languages.typescript.ScriptTarget.ES2016,
          allowNonTsExtensions: true,
          moduleResolution:
            monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          module: monaco.languages.typescript.ModuleKind.CommonJS,
          noEmit: true,
          typeRoots: ["node_modules/@types"],
        });

        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          props.extraLib,
          libName
        );

        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: true,
          noSyntaxValidation: false,
        });
      }

      const schemaId = uniqueId("schema_");
      let schemaModel: monaco.editor.ITextModel | null = null;

      if (props.defaultLanguage === "graphql" && props.schema) {
        schemaModel = monaco.editor.createModel(
          props.schema.str,
          "graphql",
          monaco.Uri.parse(`${schemaId}.graphql`)
        );

        monaco.languages.registerDefinitionProvider(
          "graphql",
          new GraphQLDefinitionProvider(props.schema, schemaModel)
        );
      }

      let libLanguage = props.defaultLanguage;

      if (libLanguage === "javascript") {
        libLanguage = "typescript";
      }

      let defaultValue = props.defaultValue || "";

      if (typeof defaultValue !== "string") {
        defaultValue = JSON.stringify(defaultValue, null, 2);
      }

      const model = monaco.editor.createModel(
        defaultValue,
        libLanguage ?? "graphql",
        monaco.Uri.parse(fileName)
      );

      const editor = monaco.editor.create(wrapperRef.current, {
        value: props.defaultValue ?? "",
        language: props.defaultLanguage ?? "graphql",
        theme: props.theme === "dark" ? "inigo-dark" : "inigo",
        automaticLayout: true,
        minimap: {
          enabled: false,
        },
        tabSize: 2,
        autoDetectHighContrast: false,
        scrollbar: {
          alwaysConsumeMouseWheel: false,
        },
        scrollBeyondLastLine: false,
        wordWrap: props.wordWrap,
        padding: {
          top: props.padding ?? 16,
          bottom: props.padding ?? 16,
        },
        glyphMargin: false,
        model,
        quickSuggestions: props.readOnly ? false : true,
        dragAndDrop: props.readOnly ? false : true,
        contextmenu: props.readOnly ? false : true,
      });

      if (props.readOnly) {
        editor.addCommand(monaco.KeyCode.F1, () => {});

        editor.onKeyDown((event) => {
          const { keyCode, ctrlKey, metaKey } = event;

          if (keyCode === 52 && (metaKey || ctrlKey)) {
            event.preventDefault();
          }
        });
      }

      if (props.defaultLanguage === "graphql") {
        (editor as any)._codeEditorService.openCodeEditor = () => {
          const selection = editor.getSelection();

          if (!selection) {
            return;
          }

          const path = findPropertyPathInAST(editor.getValue(), {
            lineStart: selection.startLineNumber,
            lineEnd: selection.endLineNumber,
            colStart: selection.startColumn,
            colEnd: selection.endColumn,
          });

          if (path) {
            updateQueryParams(
              {
                requestId: null,
                requestHash: null,
                requestObservedAt: null,
                tab: null,
                fieldPath_EQ: path,
              },
              "push"
            );

            // closeDetailsRequestDrawer(navigate);
          }
        };
      }

      if (editorRef.current) {
        const position = editorRef.current.getPosition();

        if (position) {
          editor.setPosition(position);
        }
      }

      model.onDidChangeContent((e) => {
        if (!e.isFlush) {
          props.onChange?.(model.getValue());
        }
      });

      const debouncedTriggerSuggest = debounce(() => {
        if (editor.getValue().replace(/(\s|\n|\t)/g, "")) {
          editor.trigger("graphql", "editor.action.triggerSuggest", {});
        }
      }, 1000);

      if (props.defaultLanguage === "graphql") {
        editor.onDidChangeModelContent((e) => {
          if (!e.changes[0].text.replace(/(\s|\n|\t)/g, "")) {
            debouncedTriggerSuggest();
          }
        });

        let decorationsCollection: monaco.editor.IEditorDecorationsCollection | null =
          null;

        editor.onDidChangeCursorPosition((e) => {
          decorationsCollection?.clear();

          try {
            const value = editor.getValue();
            const doc = parse(value);

            const definition = doc.definitions.find((definition) => {
              if (definition.kind !== "OperationDefinition") {
                return false;
              }

              if (!definition.loc) {
                return false;
              }

              const cursorPosition = editor.getPosition();

              if (cursorPosition) {
                return (
                  definition.loc.startToken.line <= cursorPosition.lineNumber &&
                  definition.loc.endToken.line >= cursorPosition.lineNumber
                );
              }
            });

            if (definition?.loc) {
              const decorations: monaco.editor.IModelDeltaDecoration[] = [];

              if (definition.loc.startToken.line > 1) {
                decorations.push({
                  range: new monaco.Range(
                    0,
                    0,
                    definition.loc.startToken.line - 1,
                    definition.loc.startToken.column
                  ),
                  options: {
                    isWholeLine: true,
                    inlineClassName: "inactive-line",
                  },
                });
              }

              const lineCount = editor.getModel()?.getLineCount() ?? 0;
              const lastLineMaxColumn =
                editor.getModel()?.getLineMaxColumn(lineCount) ?? 0;

              if (definition.loc.endToken.line < lineCount) {
                decorations.push({
                  range: new monaco.Range(
                    definition.loc.endToken.line + 1,
                    definition.loc.endToken.column,
                    lineCount,
                    lastLineMaxColumn
                  ),
                  options: {
                    isWholeLine: true,
                    inlineClassName: "inactive-line",
                  },
                });
              }

              decorationsCollection =
                editor.createDecorationsCollection(decorations);
            }
          } catch (error) {}

          props.onCursorPositionChange?.(e.position);
        });
      }

      const messageContribution = editor.getContribution(
        "editor.contrib.messageController"
      );
      editor.onDidAttemptReadOnlyEdit(() =>
        (messageContribution as any)?.closeMessage()
      );

      setModel(model);
      setEditor(editor);

      function handleResize() {
        editor.layout();
      }

      window.addEventListener("resize", handleResize);

      return () => {
        model.dispose();
        schemaModel?.dispose();
        editor.dispose();

        window.removeEventListener("resize", handleResize);
      };
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.defaultLanguage,
    props.theme,
    props.readOnly,
    props.extraLib,
    props.jsonSchema,
    props.schema,
  ]);

  useEffect(() => {
    if (props.graphQLSchema && !props.readOnly) {
      if (apiRef.current) {
        apiRef.current.setSchemaConfig([
          {
            introspectionJSON:
              props.graphQLSchema as unknown as IntrospectionQuery,
            uri: "schema.graphql",
          },
        ]);
      } else {
        apiRef.current = initializeMode({
          diagnosticSettings: {
            jsonDiagnosticSettings: {
              validate: true,
              schemaValidation: "error",
              allowComments: true,
              trailingCommas: "ignore",
            },
          },
          schemas: [
            {
              introspectionJSON:
                props.graphQLSchema as unknown as IntrospectionQuery,
              uri: "schema.graphql",
            },
          ],
        });
      }
    } else {
      if (apiRef.current) {
        apiRef.current.setSchemaConfig([]);
      }
    }
  }, [props.graphQLSchema, props.readOnly]);

  useImperativeHandle(
    ref,
    () => ({
      setValue: (value) => {
        if (model) {
          if (typeof value !== "string") {
            value = JSON.stringify(value, null, 2);
          }

          model.setValue(value);
        }
      },
      getValue: () => {
        return model?.getValue() ?? "";
      },
      validate: () => {
        return true;
      },
      setError: () => {},
      setMarkers: (markers) => {
        if (model) {
          monaco.editor.setModelMarkers(model, "owner", markers);
        }
      },
      getPosition: () => {
        return editor?.getPosition() ?? { lineNumber: 0, column: 0 };
      },
      focus: (cursorPosition) => {
        editor?.focus();
        editor?.setPosition(cursorPosition ?? { lineNumber: 0, column: 0 });
      },
      clear: () => {
        if (model) {
          model.setValue("");
        }
      },

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }),
    [editor, model]
  );

  return (
    <div
      className={classNames(styles.editor, props.className)}
      style={props.style}
      onKeyDown={(ev) => {
        if (props.readOnly) {
          if (ev.key === "c" && ev.metaKey) {
            return;
          }

          if (
            (document.activeElement as HTMLTextAreaElement)?.tagName ===
              "TEXTAREA" &&
            (document.activeElement as HTMLTextAreaElement)?.classList.contains(
              "input"
            )
          ) {
            return;
          }

          ev.preventDefault();
        }
      }}
    >
      {props.label && <div className={styles.label}>{props.label}</div>}
      <div className={styles.wrapper} ref={wrapperRef}>
        {/* <Editor
          height="100%"
          theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
          defaultLanguage={props.defaultLanguage ?? 'graphql'}
          defaultValue={
            typeof props.defaultValue === 'string' ? props.defaultValue : JSON.stringify(props.defaultValue, null, 2)
          }
          onChange={onEditorChange}
          onMount={onEditorDidMount}
          options={{
            fontFamily: 'Roboto Mono',
            fontSize: 12,
            fontWeight: '500',
            lineHeight: 26,
            // tabIndex: 2,
            // tabSize: 4,
            minimap: {
              enabled: false,
            },
            // lineNumbers: 'off',
            // selectOnLineNumbers: false,
            // glyphMargin: false,
            // folding: false,
            // lineDecorationsWidth: 0,
            // contextmenu: false,
            tabSize: 2,
            readOnly: props.readOnly,
            autoDetectHighContrast: false,
            // padding: {top: 24, bottom: 24},
            scrollbar: {
              alwaysConsumeMouseWheel: false,
            },
          }}
          beforeMount={handleEditorWillMount}
        /> */}
      </div>
    </div>
  );
};

export default forwardRef(CodeEditor);

import { capitalize } from 'lodash';
import {
  ArgumentNode,
  DefinitionNode,
  DocumentNode,
  FieldNode,
  GraphQLField,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLType,
  Kind,
  Location,
  OperationDefinitionNode,
  OperationTypeNode,
  parse,
  print,
  SelectionNode,
  VariableDefinitionNode,
  visit,
} from 'graphql';

type Maybe<T> = T | null | undefined;

export function healQuery(query: string) {
  return query.replace(/\{(\s+)?\}/g, '');
}

export function extractOfType(type: GraphQLOutputType): any {
  if (type instanceof GraphQLNonNull) {
    return extractOfType(type.ofType);
  }

  if (type instanceof GraphQLNonNull) {
    // @ts-ignore
    return extractOfType(type.ofType);
  }

  if (type instanceof GraphQLList) {
    return extractOfType(type.ofType);
  }

  if (type instanceof GraphQLObjectType) {
    return type;
  }

  if (type instanceof GraphQLScalarType) {
    return type;
  }
}

export function findFieldTypeInSchema(path: string, schema: GraphQLSchema) {
  if (!path) {
    return;
  }

  const [operation, ...segments] = path.split('.') as [OperationTypeNode, ...string[]];

  let type: Maybe<GraphQLType>;

  if (operation === 'query') {
    type = schema.getQueryType();
  } else if (operation === 'mutation') {
    type = schema.getMutationType();
  } else if (operation === 'subscription') {
    type = schema.getSubscriptionType();
  }

  if (!type) {
    return;
  }

  for (const segment of segments) {
    if (!type) {
      return;
    }

    if (type instanceof GraphQLObjectType) {
      const field = type.getFields()[segment] as GraphQLField<any, any>;

      if (!field) {
        return;
      }

      type = extractOfType(field.type);
    }
  }

  if (!type) {
    return;
  }

  return extractOfType(type as GraphQLOutputType);
}

export function findFieldInSchema(path: string, schema: GraphQLSchema) {
  const [operation, ...segments] = path.split('.') as [OperationTypeNode, ...string[]];

  let type: Maybe<GraphQLType>;

  if (operation === 'query') {
    type = schema.getQueryType();
  } else if (operation === 'mutation') {
    type = schema.getMutationType();
  } else if (operation === 'subscription') {
    type = schema.getSubscriptionType();
  }

  if (!type) {
    return;
  }

  for (let i = 0; i < segments.length; ++i) {
    if (!type) {
      return;
    }

    if (type instanceof GraphQLObjectType) {
      const field = type.getFields()[segments[i]] as GraphQLField<any, any>;

      if (!field) {
        return;
      }

      if (i === segments.length - 1) {
        return field;
      }

      type = extractOfType(field.type);
    }
  }

  return null;
}

export function addFieldToQuery(query: string, path: string, schema: GraphQLSchema, operationName?: string) {
  query = healQuery(query);

  const [operation, ...segments] = path.split('.') as [OperationTypeNode, ...string[]];

  let doc: DocumentNode | undefined;

  try {
    doc = parse(query);
  } catch {}

  if (!doc) {
    doc = {
      kind: Kind.DOCUMENT,
      definitions: [
        {
          kind: Kind.OPERATION_DEFINITION,
          operation,
          name: {
            kind: Kind.NAME,
            value: `New${capitalize(operation)}`,
          },
          selectionSet: {
            kind: Kind.SELECTION_SET,
            selections: [],
          },
        },
      ],
    };
  }

  let operationDefinition: OperationDefinitionNode = doc.definitions.find((v) => {
    if (v.kind === Kind.OPERATION_DEFINITION && v.operation === operation) {
      if (operationName) {
        return v.name?.value === operationName;
      }

      return true;
    }

    return false;
  }) as OperationDefinitionNode;

  if (!operationDefinition) {
    operationDefinition = {
      kind: Kind.OPERATION_DEFINITION,
      operation: operation,
      name: {
        kind: Kind.NAME,
        value: `New${capitalize(operation)}`,
      },
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: [],
      },
    };

    (doc.definitions as DefinitionNode[]).push(operationDefinition);
  }

  if (segments.length === 0) {
    return {
      query: print(doc)
        .split('\n')
        .map((v) => {
          if (v.includes(`${operation} New${capitalize(operation)}`)) {
            return v + ' {}';
          }

          return v;
        })
        .join('\n'),
    };
  }

  let currentPath: string[] = [];

  const variables: {
    name: string;
    type: string;
  }[] = [];

  visit(operationDefinition, {
    OperationDefinition: {
      enter(operationDefinition) {
        const fieldName = segments[0];

        if (!operationDefinition.selectionSet) {
          // @ts-ignore
          operationDefinition.selectionSet = {
            kind: Kind.SELECTION_SET,
            selections: [],
          };
        }

        let fieldNode: FieldNode = operationDefinition.selectionSet.selections.find((v) => {
          return v.kind === Kind.FIELD && v.name.value === fieldName;
        }) as FieldNode;

        if (!fieldNode) {
          fieldNode = {
            kind: Kind.FIELD,
            name: {
              kind: Kind.NAME,
              value: fieldName,
            },
          };

          const typeField = findFieldInSchema([operation, ...currentPath, fieldName].join('.'), schema);

          if (typeField && typeField.args) {
            typeField.args.forEach((arg) => {
              if (!arg.type.toString().endsWith('!')) {
                return;
              }

              if (!operationDefinition.variableDefinitions) {
                // @ts-ignore
                operationDefinition.variableDefinitions = [];
              }

              let variableName = arg.name;

              let i = 2;

              while (
                (operationDefinition.variableDefinitions as VariableDefinitionNode[]).find(
                  (v) => v.variable.name.value === variableName,
                )
              ) {
                variableName = arg.name + i;
                ++i;
              }

              (operationDefinition.variableDefinitions as VariableDefinitionNode[]).push({
                kind: Kind.VARIABLE_DEFINITION,
                variable: {
                  kind: Kind.VARIABLE,
                  name: {
                    kind: Kind.NAME,
                    value: variableName,
                  },
                },
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: {
                    kind: Kind.NAME,
                    value: arg.type.toString(),
                  },
                },
              });

              if (!fieldNode.arguments) {
                // @ts-ignore
                fieldNode.arguments = [];
              }

              (fieldNode.arguments as ArgumentNode[]).push({
                kind: Kind.ARGUMENT,
                name: {
                  kind: Kind.NAME,
                  value: arg.name,
                },
                value: {
                  kind: Kind.VARIABLE,
                  name: {
                    kind: Kind.NAME,
                    value: variableName,
                  },
                },
              });

              variables.push({
                name: variableName,
                type: arg.type.toString(),
              });
            });
          }

          (operationDefinition.selectionSet.selections as SelectionNode[]).push(fieldNode);
        }
      },
    },
    Field: {
      enter(field) {
        currentPath.push(field.name.value);

        if (currentPath.every((v, i) => v === segments[i])) {
          if (currentPath.length === segments.length) {
            return false;
          }

          const fieldName = segments[currentPath.length];

          if (!field.selectionSet) {
            // @ts-ignore
            field.selectionSet = {
              kind: Kind.SELECTION_SET,
              selections: [],
            };
          }

          let fieldNode: FieldNode = field.selectionSet!.selections.find((v) => {
            return v.kind === Kind.FIELD && v.name.value === fieldName;
          }) as FieldNode;

          if (!fieldNode) {
            fieldNode = {
              kind: Kind.FIELD,
              name: {
                kind: Kind.NAME,
                value: fieldName,
              },
            };

            const typeField = findFieldInSchema([operation, ...currentPath, fieldName].join('.'), schema);

            if (typeField && typeField.args) {
              typeField.args.forEach((arg) => {
                if (!arg.type.toString().endsWith('!')) {
                  return;
                }

                if (!operationDefinition.variableDefinitions) {
                  // @ts-ignore
                  operationDefinition.variableDefinitions = [];
                }

                let variableName = arg.name;

                let i = 2;

                while (
                  (operationDefinition.variableDefinitions as VariableDefinitionNode[]).find(
                    (v) => v.variable.name.value === variableName,
                  )
                ) {
                  variableName = arg.name + i;
                  ++i;
                }

                (operationDefinition.variableDefinitions as VariableDefinitionNode[]).push({
                  kind: Kind.VARIABLE_DEFINITION,
                  variable: {
                    kind: Kind.VARIABLE,
                    name: {
                      kind: Kind.NAME,
                      value: variableName,
                    },
                  },
                  type: {
                    kind: Kind.NAMED_TYPE,
                    name: {
                      kind: Kind.NAME,
                      value: arg.type.toString(),
                    },
                  },
                });

                if (!fieldNode.arguments) {
                  // @ts-ignore
                  fieldNode.arguments = [];
                }

                (fieldNode.arguments as ArgumentNode[]).push({
                  kind: Kind.ARGUMENT,
                  name: {
                    kind: Kind.NAME,
                    value: arg.name,
                  },
                  value: {
                    kind: Kind.VARIABLE,
                    name: {
                      kind: Kind.NAME,
                      value: variableName,
                    },
                  },
                });

                variables.push({
                  name: variableName,
                  type: arg.type.toString(),
                });
              });
            }

            (field.selectionSet!.selections as SelectionNode[]).push(fieldNode);
          }
        }
      },
      leave() {
        currentPath.pop();
      },
    },
  });

  return {
    query: print(doc),
    variables,
  };
}

export function removeFieldFromQuery(query: string, path: string, operationName?: string) {
  query = healQuery(query);

  const [operation, ...segments] = path.split('.') as [OperationTypeNode, ...string[]];

  let doc: DocumentNode | undefined;

  try {
    doc = parse(query);
  } catch {}

  if (!doc) {
    return {
      query,
    };
  }

  let operationDefinition: OperationDefinitionNode = doc.definitions.find((v) => {
    if (v.kind === Kind.OPERATION_DEFINITION && v.operation === operation) {
      if (operationName) {
        return v.name?.value === operationName;
      }

      return true;
    }

    return false;
  }) as OperationDefinitionNode;

  if (!operationDefinition) {
    return {
      query,
    };
  }

  let currentPath: string[] = [];
  let isOperationSelectionSetEmpty = false;

  visit(operationDefinition, {
    OperationDefinition: {
      enter(operationDefinition) {
        if (segments.length === 1) {
          const fieldName = segments[0];

          if (operationDefinition.selectionSet) {
            operationDefinition.selectionSet.selections = operationDefinition.selectionSet.selections.filter((v) => {
              return v.kind !== Kind.FIELD || v.name.value !== fieldName;
            });

            isOperationSelectionSetEmpty = operationDefinition.selectionSet.selections.length === 0;
          }
        }
      },
    },
    Field: {
      enter(field) {
        currentPath.push(field.name.value);

        if (currentPath.length === segments.length - 1 && currentPath.every((v, i) => v === segments[i])) {
          const fieldName = segments[currentPath.length];

          if (field.selectionSet) {
            field.selectionSet.selections = field.selectionSet.selections.filter((v) => {
              return v.kind !== Kind.FIELD || v.name.value !== fieldName;
            });
          }
        }
      },
      leave() {
        currentPath.pop();
      },
    },
  });

  if (isOperationSelectionSetEmpty) {
    if (doc.definitions.length > 1) {
      return {
        query: `${print({
          ...doc,
          definitions: doc.definitions.filter((v) => v !== operationDefinition),
        })}
${operation} ${operationDefinition.name?.value} {}`,
      };
    } else {
      return {
        query: `${operation} ${operationDefinition.name?.value} {}`,
      };
    }
  }

  operationDefinition = doc.definitions.find((v) => {
    if (v.kind === Kind.OPERATION_DEFINITION && v.operation === operation) {
      if (operationName) {
        return v.name?.value === operationName;
      }

      return true;
    }

    return false;
  }) as OperationDefinitionNode;

  let fieldWithEmptySelectionSetLoc: Location | undefined;
  currentPath = [];

  visit(operationDefinition, {
    Field: {
      enter(field) {
        currentPath.push(field.name.value);

        if (currentPath.length === segments.length - 1 && currentPath.every((v, i) => v === segments[i])) {
          if (!field.selectionSet || field.selectionSet?.selections.length === 0) {
            fieldWithEmptySelectionSetLoc = field.loc;
          }
        }
      },
      leave() {
        currentPath.pop();
      },
    },
  });

  let printedQuery = print(doc);

  if (fieldWithEmptySelectionSetLoc) {
    printedQuery =
      printedQuery.slice(0, fieldWithEmptySelectionSetLoc.end) +
      ' {}' +
      printedQuery.slice(fieldWithEmptySelectionSetLoc.end);
  }

  return {
    query: printedQuery,
  };
}

export function addArgToField(
  query: string,
  path: string,
  argName: string,
  schema: GraphQLSchema,
  operationName?: string,
) {
  const [operation, ...segments] = path.split('.') as [OperationTypeNode, ...string[]];

  let doc: DocumentNode | undefined;

  try {
    doc = parse(query);
  } catch {}

  if (!doc) {
    return {
      query,
    };
  }

  let operationDefinition: OperationDefinitionNode = doc.definitions.find((v) => {
    if (v.kind === Kind.OPERATION_DEFINITION && v.operation === operation) {
      if (operationName) {
        return v.name?.value === operationName;
      }

      return true;
    }

    return false;
  }) as OperationDefinitionNode;

  if (!operationDefinition) {
    return {
      query,
    };
  }

  let currentPath: string[] = [];

  const variables: {
    name: string;
    type: string;
  }[] = [];

  visit(operationDefinition, {
    Field: {
      enter(field) {
        currentPath.push(field.name.value);

        if (currentPath.length === segments.length - 1 && currentPath.every((v, i) => v === segments[i])) {
          const fieldName = segments[currentPath.length];

          if (field.selectionSet) {
            const typeField = findFieldInSchema([operation, ...currentPath, fieldName].join('.'), schema);

            if (typeField && typeField.args) {
              const arg = typeField.args.find((v) => v.name === argName);

              if (arg) {
                if (!operationDefinition.variableDefinitions) {
                  // @ts-ignore
                  operationDefinition.variableDefinitions = [];
                }

                let variableName = arg.name;

                let i = 2;

                while (
                  (operationDefinition.variableDefinitions as VariableDefinitionNode[]).find(
                    (v) => v.variable.name.value === variableName,
                  )
                ) {
                  variableName = arg.name + i;
                  ++i;
                }

                (operationDefinition.variableDefinitions as VariableDefinitionNode[]).push({
                  kind: Kind.VARIABLE_DEFINITION,
                  variable: {
                    kind: Kind.VARIABLE,
                    name: {
                      kind: Kind.NAME,
                      value: variableName,
                    },
                  },
                  type: {
                    kind: Kind.NAMED_TYPE,
                    name: {
                      kind: Kind.NAME,
                      value: arg.type.toString(),
                    },
                  },
                });

                variables.push({
                  name: variableName,
                  type: arg.type.toString(),
                });

                const fieldNode: FieldNode = field.selectionSet.selections.find((v) => {
                  return v.kind === Kind.FIELD && v.name.value === fieldName;
                }) as FieldNode;

                if (fieldNode) {
                  if (!fieldNode.arguments) {
                    // @ts-ignore
                    fieldNode.arguments = [];
                  }

                  // @ts-ignore
                  fieldNode.arguments.push({
                    kind: Kind.ARGUMENT,
                    name: {
                      kind: Kind.NAME,
                      value: argName,
                    },
                    value: {
                      kind: Kind.VARIABLE,
                      name: {
                        kind: Kind.NAME,
                        value: variableName,
                      },
                    },
                  });
                }
              }
            }
          }
        }
      },
      leave() {
        currentPath.pop();
      },
    },
    OperationDefinition: {
      enter(operationDefinition) {
        if (segments.length === 1) {
          const fieldName = segments[0];

          if (operationDefinition.selectionSet) {
            const typeField = findFieldInSchema([operation, ...currentPath, fieldName].join('.'), schema);

            if (typeField && typeField.args) {
              const arg = typeField.args.find((v) => v.name === argName);

              if (arg) {
                if (!operationDefinition.variableDefinitions) {
                  // @ts-ignore
                  operationDefinition.variableDefinitions = [];
                }

                let variableName = arg.name;

                let i = 2;

                while (
                  (operationDefinition.variableDefinitions as VariableDefinitionNode[]).find(
                    (v) => v.variable.name.value === variableName,
                  )
                ) {
                  variableName = arg.name + i;
                  ++i;
                }

                (operationDefinition.variableDefinitions as VariableDefinitionNode[]).push({
                  kind: Kind.VARIABLE_DEFINITION,
                  variable: {
                    kind: Kind.VARIABLE,
                    name: {
                      kind: Kind.NAME,
                      value: variableName,
                    },
                  },
                  type: {
                    kind: Kind.NAMED_TYPE,
                    name: {
                      kind: Kind.NAME,
                      value: arg.type.toString(),
                    },
                  },
                });

                variables.push({
                  name: variableName,
                  type: arg.type.toString(),
                });

                const fieldNode: FieldNode = operationDefinition.selectionSet.selections.find((v) => {
                  return v.kind === Kind.FIELD && v.name.value === fieldName;
                }) as FieldNode;

                if (fieldNode) {
                  if (!fieldNode.arguments) {
                    // @ts-ignore
                    fieldNode.arguments = [];
                  }

                  // @ts-ignore
                  fieldNode.arguments.push({
                    kind: Kind.ARGUMENT,
                    name: {
                      kind: Kind.NAME,
                      value: argName,
                    },
                    value: {
                      kind: Kind.VARIABLE,
                      name: {
                        kind: Kind.NAME,
                        value: variableName,
                      },
                    },
                  });
                }
              }
            }
          }
        }
      },
    },
  });

  return {
    query: print(doc),
    variables,
  };
}

export function removeArgFromField(query: string, path: string, argName: string, operationName?: string) {
  query = healQuery(query);

  const [operation, ...segments] = path.split('.') as [OperationTypeNode, ...string[]];

  let doc: DocumentNode | undefined;

  try {
    doc = parse(query);
  } catch {}

  if (!doc) {
    return {
      query,
    };
  }

  let operationDefinition: OperationDefinitionNode = doc.definitions.find((v) => {
    if (v.kind === Kind.OPERATION_DEFINITION && v.operation === operation) {
      if (operationName) {
        return v.name?.value === operationName;
      }

      return true;
    }

    return false;
  }) as OperationDefinitionNode;

  if (!operationDefinition) {
    return {
      query,
    };
  }

  let currentPath: string[] = [];

  visit(operationDefinition, {
    Field: {
      enter(field) {
        currentPath.push(field.name.value);

        if (currentPath.length === segments.length - 1 && currentPath.every((v, i) => v === segments[i])) {
          const fieldName = segments[currentPath.length];

          if (field.selectionSet) {
            const fieldNode: FieldNode = field.selectionSet.selections.find((v) => {
              return v.kind === Kind.FIELD && v.name.value === fieldName;
            }) as FieldNode;

            if (fieldNode && fieldNode.arguments) {
              // @ts-ignore
              fieldNode.arguments = fieldNode.arguments.filter((v) => {
                return v.kind !== Kind.ARGUMENT || v.name.value !== argName;
              });
            }
          }
        }
      },
      leave() {
        currentPath.pop();
      },
    },
    OperationDefinition: {
      enter(operationDefinition) {
        if (segments.length === 1) {
          const fieldName = segments[0];

          if (operationDefinition.selectionSet) {
            const fieldNode: FieldNode = operationDefinition.selectionSet.selections.find((v) => {
              return v.kind === Kind.FIELD && v.name.value === fieldName;
            }) as FieldNode;

            if (fieldNode && fieldNode.arguments) {
              // @ts-ignore
              fieldNode.arguments = fieldNode.arguments.filter((v) => {
                return v.kind !== Kind.ARGUMENT || v.name.value !== argName;
              });
            }
          }
        }
      },
    },
  });

  return {
    query: print(doc),
  };
}

export function isFieldInQuery(query: string, path: string, operationName?: string) {
  query = healQuery(query);

  const [operation, ...segments] = path.split('.') as [OperationTypeNode, ...string[]];

  let doc: DocumentNode | undefined;

  try {
    doc = parse(query);
  } catch {}

  if (!doc) {
    return false;
  }

  let operationDefinition: OperationDefinitionNode = doc.definitions.find((v) => {
    if (v.kind === Kind.OPERATION_DEFINITION && v.operation === operation) {
      if (operationName) {
        return v.name?.value === operationName;
      }

      return true;
    }

    return false;
  }) as OperationDefinitionNode;

  if (!operationDefinition) {
    return false;
  }

  if (segments.length === 0) {
    return true;
  }

  let currentPath: string[] = [];

  let found = false;

  visit(operationDefinition, {
    Field: {
      enter(field) {
        currentPath.push(field.name.value);

        if (currentPath.length === segments.length && currentPath.every((v, i) => v === segments[i])) {
          found = true;
          return false;
        }
      },
      leave() {
        currentPath.pop();
      },
    },
  });

  return found;
}

export function isArgInQuery(query: string, path: string, argName: string, operationName?: string) {
  query = healQuery(query);

  const [operation, ...segments] = path.split('.') as [OperationTypeNode, ...string[]];

  let doc: DocumentNode | undefined;

  try {
    doc = parse(query);
  } catch {}

  if (!doc) {
    return false;
  }

  let operationDefinition: OperationDefinitionNode = doc.definitions.find((v) => {
    if (v.kind === Kind.OPERATION_DEFINITION && v.operation === operation) {
      if (operationName) {
        return v.name?.value === operationName;
      }

      return true;
    }

    return false;
  }) as OperationDefinitionNode;

  if (!operationDefinition) {
    return false;
  }

  let currentPath: string[] = [];

  let found = false;

  visit(operationDefinition, {
    Field: {
      enter(field) {
        currentPath.push(field.name.value);

        if (currentPath.length === segments.length && currentPath.every((v, i) => v === segments[i])) {
          if (field.arguments) {
            found = field.arguments.some((v) => v.name.value === argName);
          }
        }
      },
      leave() {
        currentPath.pop();
      },
    },
  });

  return found;
}

export function addAllTypeFieldsToQuery(query: string, path: string, schema: GraphQLSchema, operationName?: string) {
  const type = findFieldTypeInSchema(path, schema) as GraphQLObjectType;
  const fields = type.getFields();

  let variables: {
    name: string;
    type: string;
  }[] = [];

  for (const field of Object.values(fields)) {
    const result = addFieldToQuery(query, path + '.' + field.name, schema, operationName);

    query = result.query;

    if (result.variables) {
      variables = variables.concat(result.variables);
    }
  }

  return {
    query,
    variables,
  };
}

export function addAllTypeFieldsToQueryRecursively(
  query: string,
  path: string,
  schema: GraphQLSchema,
  operationName?: string,
  level = 0,
  visited: string[] = [],
) {
  if (level > 5) {
    return {
      query,
      variables: [],
    };
  }

  const type = findFieldTypeInSchema(path, schema) as GraphQLObjectType;

  let variables: {
    name: string;
    type: string;
  }[] = [];

  if (!type || !('getFields' in type)) {
    return {
      query,
      variables,
    };
  }

  if (visited.includes(type.name)) {
    return {
      query,
      variables,
    };
  }

  visited.push(type.name);

  const fields = type.getFields();

  for (const field of Object.values(fields)) {
    const result = addFieldToQuery(query, path + '.' + field.name, schema, operationName);

    query = result.query;

    if (result.variables) {
      variables = variables.concat(result.variables);
    }

    const result2 = addAllTypeFieldsToQueryRecursively(
      query,
      path + '.' + field.name,
      schema,
      operationName,
      level + 1,
      visited,
    );

    query = result2.query;

    if (result2.variables) {
      variables = variables.concat(result2.variables);
    }
  }

  return {
    query,
    variables,
  };
}

export function addAllScalarTypeFieldsToQuery(
  query: string,
  path: string,
  schema: GraphQLSchema,
  operationName?: string,
) {
  const type = findFieldTypeInSchema(path, schema) as GraphQLObjectType;
  const fields = type.getFields();

  let variables: {
    name: string;
    type: string;
  }[] = [];

  for (const field of Object.values(fields)) {
    if (extractOfType(field.type) instanceof GraphQLScalarType) {
      const result = addFieldToQuery(query, path + '.' + field.name, schema, operationName);

      query = result.query;

      if (result.variables) {
        variables = variables.concat(result.variables);
      }
    }
  }

  return {
    query,
    variables,
  };
}

export function areAllTypeFieldsInQuery(query: string, path: string, schema: GraphQLSchema, operationName?: string) {
  if (!path) {
    return false;
  }

  const type = findFieldTypeInSchema(path, schema) as GraphQLObjectType;
  const fields = type.getFields();

  for (const field of Object.values(fields)) {
    if (!isFieldInQuery(query, path + '.' + field.name, operationName)) {
      return false;
    }
  }

  return true;
}

export function removeTypeFieldsFromQuery(query: string, path: string, schema: GraphQLSchema, operationName?: string) {
  const type = findFieldTypeInSchema(path, schema) as GraphQLObjectType;
  const fields = type.getFields();

  for (const field of Object.values(fields)) {
    query = removeFieldFromQuery(query, path + '.' + field.name, operationName).query;
  }

  return query;
}

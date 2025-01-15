# GraphQL Explorer Component for React

This repository contains an open-source **GraphQL Explorer Component** for React, enabling developers to easily integrate an interactive GraphQL playground into their React applications.

## Features

The GraphQL Explorer is designed with developers in mind, offering features that simplify workflows and enhance productivity. Here’s what it includes:

- **Query Builder:** Construct complex GraphQL queries with an easy-to-use interface.
- **History:** Quickly access and reuse previous queries.
- **Saved Collections:** Keep your frequently used queries organized and ready.
- **Define Extension Headers:** Customize and add extension headers to your GraphQL requests for advanced use cases.
- **Share Queries:** Share queries with others, whether or not they include variables.
- **Multi-Tab Support:** Work on multiple queries simultaneously for better multitasking.
- **Run 10x Options:** Send multiple queries at once to test performance and scalability.
- **Response Viewer with Headers:** Debug effectively with detailed response and header insights.
- **Schema Viewer:** Navigate and explore your schema with a visual overview.
- **PreFlight Scripts:** Set up login or other pre-configurations before running queries.
- **Local Preferences**: Save and retrieve user preferences, such as layout and active tabs.

---

## Installation

Install the package via npm or yarn:

```bash
npm install @inigolabs/graphql-explorer
```

or

```bash
yarn add @inigolabs/graphql-explorer
```

---

## Usage

Import the `Explorer` component and include it in your application. The `defaultState` prop is **required** to initialize the explorer.

```tsx
import "@inigolabs/graphql-explorer/styles";
import Explorer from "@inigolabs/graphql-explorer";

function App() {
  const defaultState = {};

  return (
    <div>
      <Explorer
        defaultState={defaultState}
        onStateChange={(state) => console.log("Explorer state updated:", state)}
      />
    </div>
  );
}
```

---

## API

### **Props**

| Prop            | Type                             | Required | Description                                                                          |
| --------------- | -------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `theme`         | `"light"  \|  "dark"`            | No       | Sets the theme for the explorer interface.                                           |
| `access`        | `"admin"  \|  "user"`            | No       | Specifies the access level of the current user.                                      |
| `defaultState`  | `ExplorerState`                  | Yes      | Initial state for the explorer, including tabs, collections, and layout preferences. |
| `onStateChange` | `(state: ExplorerState) => void` | No       | Callback triggered when the state of the explorer changes.                           |

---

## `ExplorerState` Description

The `ExplorerState` object represents the state of the GraphQL Explorer, which is essential for initializing and managing the component's behavior.

### **Structure**

| Key                | Type                                                     | Description                                                                            |
| ------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `url`              | `string`                                                 | The base URL for the GraphQL endpoint.                                                 |
| `collections`      | `ExplorerCollection[]`                                   | Saved collections of reusable queries and their variables.                             |
| `history`          | `ExplorerTabHistoryItem[]`                               | History of previously executed queries.                                                |
| `headers`          | `string`                                                 | JSON string representing custom headers for GraphQL requests.                          |
| `envVariables`     | `string`                                                 | JSON string of environment variables used during queries.                              |
| `preflightScript`  | `string`                                                 | Script executed before sending requests, useful for custom logic.                      |
| `preflightEnabled` | `boolean`                                                | Flag indicating if the preflight script is enabled.                                    |
| `tabs`             | `ExplorerTab[]`                                          | Array of tabs representing open queries in the explorer.                               |
| `activeTabId`      | `string`                                                 | The ID of the currently active tab.                                                    |
| `proxyEnabled`     | `boolean`                                                | Flag indicating if a proxy is enabled for requests.                                    |
| `historyEnabled`   | `boolean`                                                | Flag indicating if query history is enabled.                                           |
| `layout`           | `{ tab?: [number, number]; request?: [number, number] }` | Layout configuration for the explorer's UI components, such as tab and request panels. |

---

### **Children Types**

#### `ExplorerCollection`

Represents a collection of saved queries.

| Key          | Type                            | Description                                     |
| ------------ | ------------------------------- | ----------------------------------------------- |
| `id`         | `string`                        | Unique identifier for the collection.           |
| `name`       | `string`                        | Name of the collection.                         |
| `operations` | `ExplorerCollectionOperation[]` | List of operations (queries) in the collection. |

---

#### `ExplorerCollectionOperation`

Represents an operation (query) within a collection.

| Key         | Type     | Description                     |
| ----------- | -------- | ------------------------------- |
| `name`      | `string` | Name of the operation.          |
| `query`     | `string` | GraphQL query string.           |
| `variables` | `string` | JSON string of query variables. |

---

#### `ExplorerTab`

Represents a tab in the explorer.

| Key         | Type                       | Description                                         |
| ----------- | -------------------------- | --------------------------------------------------- |
| `id`        | `string`                   | Unique identifier for the tab.                      |
| `query`     | `string`                   | The GraphQL query in the tab.                       |
| `variables` | `string`                   | JSON string of variables associated with the query. |
| `response`  | `ExplorerTabInfoResponse`  | The response data for the query.                    |
| `doc`       | `ReturnType<typeof parse>` | Parsed GraphQL document from the query.             |

---

#### `ExplorerTabHistoryItem`

Extends `ExplorerTab` with additional metadata for history entries.

| Key             | Type     | Description                                   |
| --------------- | -------- | --------------------------------------------- |
| `operationName` | `string` | The name of the operation in the history.     |
| `createdAt`     | `string` | Timestamp when the history entry was created. |

---

#### `ExplorerTabInfoResponse`

Represents the response information for a tab's query.

| Key       | Type     | Description                                 |
| --------- | -------- | ------------------------------------------- |
| `data`    | `any`    | The response data from the query.           |
| `headers` | `any`    | Headers returned from the response.         |
| `status`  | `number` | HTTP status code of the response.           |
| `size`    | `number` | Size of the response data in bytes.         |
| `time`    | `number` | Time taken for the request in milliseconds. |

---

## Contribution

We welcome contributions to enhance this component. Please follow these steps:

1. Fork the repository.
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Create a new branch: `git checkout -b feature-name`.
5. Commit your changes: `git commit -m 'Add feature'`.
6. Push the branch: `git push origin feature-name`.
7. Submit a pull request.

## FAQ
* To run the Expoler on Next JS, disable server side rendering.
* create-react-app is deprecated and no longer supported.

---

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

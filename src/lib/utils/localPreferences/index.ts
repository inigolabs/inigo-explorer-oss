import {
  ExplorerCollection,
  ExplorerTab,
  ExplorerTabHistoryItem,
} from '../../Explorer/Explorer';
const LOCAL_STORAGE_ID = 'inigo.localPreferences';

export interface ILocalPreferencesDataExplorer {
  url?: string;
  collections?: ExplorerCollection[];
  history?: ExplorerTabHistoryItem[];
  headers?: string;
  envVariables?: string;
  preflightScript?: string;
  preflightEnabled?: boolean;
  tabs?: ExplorerTab[];
  activeTabId?: string;
  proxyEnabled?: boolean;
  historyEnabled?: boolean;
  layout?: {
    tab?: [number, number];
    request?: [number, number];
  };
}

export interface ILocalPreferencesData {
  activeServicePath?: string | null;
  navigationExpanded?: boolean;
  welcomeModal: string[];
  redirectTo?: string;
  theme?: 'light' | 'dark' | 'system';
  explorer: ILocalPreferencesDataExplorer;
  observe: {
    filtersPresets: {
      [key: string]: {
        filters: {
          [key: string]: any;
        };
        isFavorite?: boolean;
        createdAt?: string;
      };
    };
  };
  dataTablesMeta?: {
    version: number;
    data: Record<string, {
      columnsWidth: Record<string, number>;
      columnsOrder: [string]
    }>;
  };
}

class LocalPreferences {
  private data: ILocalPreferencesData = {
    welcomeModal: [],
    explorer: {},
    observe: {
      filtersPresets: {},
    },
  };

  constructor() {
    const localStorageData = localStorage.getItem(LOCAL_STORAGE_ID);

    if (localStorageData) {
      try {
        this.data = {
          ...this.data,
          ...JSON.parse(localStorageData),
        };
      } catch (err) {
        localStorage.removeItem(LOCAL_STORAGE_ID);
      }
    }
  }

  set<T extends keyof ILocalPreferencesData>(key: T, value: ILocalPreferencesData[T]) {
    this.data[key] = value;

    localStorage.setItem(LOCAL_STORAGE_ID, JSON.stringify(this.data));
  }

  get<T extends keyof ILocalPreferencesData>(key: T): ILocalPreferencesData[T] {
    return this.data[key];
  }

  delete<T extends keyof ILocalPreferencesData>(key: T) {
    delete this.data[key];

    localStorage.setItem(LOCAL_STORAGE_ID, JSON.stringify(this.data));
  }
}

export default new LocalPreferences();

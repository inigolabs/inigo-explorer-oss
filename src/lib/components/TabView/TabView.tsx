import styles from "./TabView.module.css";

import { useEffect, useMemo, useState } from "react";
import classNames from "classnames";

import { TabProps, TabViewProps } from "./TabView.types";
import {
  addQueryParamsListener,
  getQueryParamByName,
  removeQueryParamsListener,
  updateQueryParamByName,
} from "../../utils/queryParams";

const Tab = (props: TabProps) => {
  return (
    <div
      className={classNames(
        styles.TabContainer,
        props.disabled && styles.disabled
      )}
    >
      {props.children}
    </div>
  );
};

const TabView = (props: TabViewProps) => {
  const [activeTabName, _setActiveTabName] = useState<string | null>(null);
  const [tabs, setTabs] = useState<React.ReactElement<TabProps>[]>([]);

  const setActiveTab = (tab: React.ReactElement<TabProps> | null) => {
    _setActiveTabName(tab?.props.path ?? null);

    if (!props.disableQueryParams) {
      const param = getQueryParamByName(props.queryParamName ?? "tab");

      if (param && tab && param === tab?.props.path) {
        return;
      }

      updateQueryParamByName(
        props.queryParamName ?? "tab",
        tab?.props.path,
        param ? "push" : "replace"
      );
    }
  };

  const activeTab = useMemo(() => {
    return (
      tabs.find((tab) => tab.props.path === activeTabName) ?? tabs[0] ?? null
    );
  }, [tabs, activeTabName]);

  useEffect(() => {
    if (props.children) {
      setTabs(
        Array.isArray(props.children) ? props.children : [props.children]
      );
    } else {
      setTabs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.children, tabs]);

  useEffect(() => {
    if (tabs.length) {
      setActiveTab(
        tabs.find(
          (tab) =>
            tab.props.path ===
            getQueryParamByName(props.queryParamName ?? "tab")
        ) ??
          tabs[0] ??
          null
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs]);

  const onQueryParamsChangeHandler = (params: Record<string, any>) => {
    if (
      tabs.length &&
      params[props.queryParamName ?? "tab"] !== activeTab?.props.path
    ) {
      setActiveTab(
        tabs.find(
          (tab) => tab.props.path === params[props.queryParamName ?? "tab"]
        ) ??
          tabs[0] ??
          null
      );
    }
  };

  useEffect(() => {
    if (props.disableQueryParams) {
      return;
    }

    addQueryParamsListener(onQueryParamsChangeHandler);

    return () => removeQueryParamsListener(onQueryParamsChangeHandler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, activeTabName]);

  return (
    <div className={styles.TabViewContainer}>
      <div
        className={classNames(
          styles.Navigation,
          tabs.length === 1 && styles.HasOneTab,
          props.disableBorder && styles.DisableBorder,
          props.disabled && styles.Disabled
        )}
      >
        {tabs.map((tab) => (
          <button
            key={tab.props.label}
            className={classNames(styles.Button, {
              [styles.Active]: tab.props.path === activeTabName,
            })}
            disabled={tab.props.disabled}
            onClick={() => {
              setActiveTab(tab);

              setTimeout(() => {
                props.onSelect?.(tab.props);
              }, 200);
            }}
          >
            <span className={styles.Text}>{tab?.props.label}</span>
            <span className={styles.TextActive}>{tab?.props.label}</span>
          </button>
        ))}
        {!!props.actions && (
          <div
            className={classNames(
              styles.Actions,
              props.disableDivider && styles.DisableDivider,
              props.actionsAlign === "left" && styles.Left,
              props.actionsAlign === "right" && styles.Right
            )}
          >
            {props.actions}
          </div>
        )}
      </div>
      <div className={styles.Content} style={props.viewStyle}>
        {activeTab}
      </div>
    </div>
  );
};

export default TabView;
export { Tab };
export * from "./TabView.types";

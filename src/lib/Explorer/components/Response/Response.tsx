import styles from "./Response.module.css";
import CodeEditor from "../../../components/code-editor";
import classNames from "classnames";
import TabView from "../../../components/TabView/TabView";
import { Tab } from "../../../components/TabView/TabView";
import { IconCheck } from "../../../components/Icon/Icon";
import Loader from "../../../components/Loader/Loader";
import { ExplorerTab } from "../../Explorer";
import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { ICodeEditorRef } from "../../../components/code-editor/code-editor.types";
import {
  renderDuration,
  renderResponseSize,
  useWindowSize,
} from "../../../utils/helpers";
import Icon from "../../../components/Icon/Icon";
import { IntrospectionQuery } from "graphql";

export interface ResponseProps {
  tab: ExplorerTab;
  url?: string;
  schema?: IntrospectionQuery;
  headers?: string;
  envVariables?: string;
  isLoading: boolean;
  // operationDeatilsReady: boolean;
  // onOperationDetailsClick?: () => void;
  preflightOutput: string[];
  preflightFailed: boolean;
  isSubscriptionActive: boolean;
  theme?: "light" | "dark";
}

export default function ExplorerResponse(props: ResponseProps) {
  const responseEditorRef = useRef<ICodeEditorRef>(null);
  const responseHeadersEditorRef = useRef<ICodeEditorRef>(null);
  const responsePreflightEditorRef = useRef<ICodeEditorRef>(null);

  useEffect(() => {
    if (responseEditorRef.current) {
      const newValue = props.tab?.response?.data
        ? JSON.stringify(props.tab?.response?.data, null, 2)
        : "";
      const currentValue = responseEditorRef.current.getValue();

      if (newValue !== currentValue) {
        responseEditorRef.current.setValue(newValue);
      }
    }

    if (responseHeadersEditorRef.current) {
      const newValue = props.tab?.response?.headers
        ? JSON.stringify(props.tab?.response?.headers, null, 2)
        : "";
      const currentValue = responseHeadersEditorRef.current.getValue();

      if (newValue !== currentValue) {
        responseHeadersEditorRef.current.setValue(newValue);
      }
    }

    if (responsePreflightEditorRef.current) {
      const newValue = props.preflightOutput.join("\n");
      const currentValue = responsePreflightEditorRef.current.getValue();

      if (newValue !== currentValue) {
        responsePreflightEditorRef.current.setValue(newValue);
      }
    }
  }, [props.tab.response, props.preflightOutput]);

  const renderInfo = useCallback(
    () => (
      <div className={styles.info}>
        <div className={styles.status}>
          <div className={styles.text}>Status:</div>
          <div className={styles.value}>
            {props.tab.response?.status ? props.tab.response?.status : "--"}
          </div>
        </div>
        <div className={styles.time}>
          <div className={styles.text}>Time:</div>
          <div className={styles.value}>
            {props.tab.response?.time
              ? renderDuration(props.tab.response?.time, 2)
              : "--"}
          </div>
        </div>
        <div className={styles.size}>
          <div className={styles.text}>Size:</div>
          <div className={styles.value}>
            {props.tab.response?.size
              ? renderResponseSize(props.tab.response?.size)
              : "--"}
          </div>
        </div>
        {props.isSubscriptionActive && (
          <div className={styles.active}>
            <div className={styles.circle} />
            <div className={styles.text}>Active</div>
          </div>
        )}
      </div>
    ),
    [props]
  );

  const windowSize = useWindowSize();

  const tabsNode = useMemo(() => {
    if (!props.tab) {
      return [];
    }

    const result = [
      <Tab label="Response" path="response">
        <CodeEditor
          padding={0}
          key="response"
          className={styles.editor}
          ref={responseEditorRef}
          defaultValue={JSON.stringify(props.tab.response?.data, null, 2)}
          defaultLanguage="json"
          readOnly
          theme={props.theme}
        />
      </Tab>,
      <Tab label="Headers" path="headers">
        <CodeEditor
          padding={0}
          key="responseHeaders"
          className={styles.editor}
          ref={responseHeadersEditorRef}
          defaultValue={JSON.stringify(props.tab.response?.headers, null, 2)}
          defaultLanguage="json"
          readOnly
          theme={props.theme}
        />
      </Tab>,
    ];

    if (props.preflightOutput.length > 0) {
      result.push(
        <Tab label="Preflight" path="preflight">
          <CodeEditor
            padding={0}
            key="preflightOutput"
            className={styles.editor}
            ref={responsePreflightEditorRef}
            defaultValue={props.preflightOutput.join("\n")}
            defaultLanguage="json"
            readOnly
            theme={props.theme}
          />
        </Tab>
      );
    }

    return result;
  }, [props]);

  const modalRef = useRef<any>(null);
  const [messageClosed, setMessageClosed] = useState(true);

  useEffect(() => {
    function onPopState() {
      if (modalRef.current?.isVisible && location.pathname === "/") {
        modalRef.current?.close();
      }
    }

    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [location]);

  return (
    <div className={classNames(styles.response, styles.card)}>
      <Loader visible={props.isLoading} />
      <div className={styles.main}>
        <TabView
          queryParamName="responseTab"
          disableDivider={windowSize.width < 1600}
          actions={<div className={styles.tabInfo}>{renderInfo()}</div>}
        >
          {tabsNode}
        </TabView>
        {import.meta.env.VITE_EXPLORER && (
          <>
            {messageClosed ? (
              <a
                className={classNames(
                  styles.closedMessage,
                  props.tab.response && props.schema && styles.visible
                )}
                // onClick={() => modalRef.current?.open()}
                href="https://app.inigo.io"
                rel="noreferrer"
                target="_blank"
              >
                Try GraphQL Analytics
                <div className={styles.icon}>
                  <div className={styles.line} />
                  <svg
                    className={styles.arrow}
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M5.04774 11.7793L9 8L5.04774 4.22068C4.90986 4.08658 4.8324 3.9047 4.8324 3.71506C4.8324 3.52541 4.90986 3.34354 5.04774 3.20944C5.18562 3.07534 5.37263 3 5.56762 3C5.76261 3 5.94962 3.07534 6.0875 3.20944L10.4933 7.49438C10.5616 7.56072 10.6159 7.63952 10.6529 7.72629C10.6899 7.81305 10.709 7.90606 10.709 8C10.709 8.09394 10.6899 8.18695 10.6529 8.27371C10.6159 8.36048 10.5616 8.43928 10.4933 8.50562L6.0875 12.7906C6.01923 12.857 5.93818 12.9096 5.84898 12.9456C5.75978 12.9815 5.66417 13 5.56762 13C5.47107 13 5.37546 12.9815 5.28626 12.9456C5.19706 12.9096 5.11601 12.857 5.04774 12.7906C4.97947 12.7242 4.92531 12.6453 4.88836 12.5586C4.85142 12.4718 4.8324 12.3788 4.8324 12.2849C4.8324 12.191 4.85142 12.0981 4.88836 12.0113C4.92531 11.9245 4.97947 11.8457 5.04774 11.7793Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
              </a>
            ) : (
              <div
                className={classNames(
                  styles.message,
                  styles.success,
                  props.tab.response && styles.visible
                )}
                onClick={() => modalRef.current?.open()}
                // href="https://app.inigo.io"
                // rel="noreferrer"
                // target="_blank"
              >
                <div className={styles.icon}>
                  <Icon icon={<IconCheck />} size={16} />
                </div>
                <div className={styles.text}>
                  Try Inigo GraphQL Analytics for free
                </div>
                <div className={styles.image}>
                  <img
                    width={92}
                    height={57}
                    src="/assets/images/analytics.png"
                    alt="Invite"
                  />
                </div>
                <div
                  className={styles.close}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    ev.preventDefault();
                    setMessageClosed(true);
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M8.70725 8.00025L13.8532 2.85425C14.0492 2.65825 14.0492 2.34225 13.8532 2.14625C13.6582 1.95125 13.3422 1.95125 13.1462 2.14625L8.00025 7.29325L2.85325 2.14625C2.65825 1.95125 2.34225 1.95125 2.14625 2.14625C1.95125 2.34225 1.95125 2.65825 2.14625 2.85425L7.29325 8.00025L2.14625 13.1462C1.95125 13.3422 1.95125 13.6582 2.14625 13.8542C2.24425 13.9513 2.37225 14.0002 2.50025 14.0002C2.62825 14.0002 2.75625 13.9513 2.85325 13.8542L8.00025 8.70725L13.1462 13.8542C13.2442 13.9513 13.3722 14.0002 13.5002 14.0002C13.6283 14.0002 13.7562 13.9513 13.8532 13.8542C14.0492 13.6582 14.0492 13.3422 13.8532 13.1462L8.70725 8.00025Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <div className={styles.footer}>{renderInfo()}</div>
    </div>
  );
}

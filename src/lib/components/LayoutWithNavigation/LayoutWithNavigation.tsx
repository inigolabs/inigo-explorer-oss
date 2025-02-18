import styles from "./LayoutWithNavigation.module.css";
import classNames from "classnames";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import List from "react-virtualized/dist/es/List";
import Icon, { ArrowDown, Collapse, Expand, IconSearch } from "../Icon/Icon";
import TextInput, { TextInputRef } from "../TextInput/TextInput";
import { renderStringWithSearch } from "../../utils/helpers";
import Loader from "../Loader/Loader";
import { debounce, get } from "lodash";
import Empty from "../Empty/Empty";
import Button, { ButtonVariant } from "../Buttons/Button";
import Tooltip from "../Tooltip/Tooltip";

export interface LayoutWithNavigationProps {
  className?: string;
  search?: {
    enabled: boolean;
  };
  onSearch?: (search: string) => void;
  navigation: {
    items: {
      title: string;
      path: string;
      data?: any;
    }[];
    groupBy?: {
      dataPath: string;
    };
    lazyLoad?: {
      hasMore: boolean;
      loadMore: () => void;
    };
    renderItem?: (props: {
      title: string;
      path: string;
      data?: any;
    }) => React.ReactNode;
    slot?: React.ReactNode;
    virtualization?: {
      enabled: boolean;
    };
    mode?: "router" | "query";
  };
  children: React.ReactNode | ((path: string) => React.ReactNode);
  loading?: boolean;
  empty?: {
    enabled: boolean;
    message?: string;
  };
}

function NavigationItem(props: {
  title: string;
  path: string;
  data?: any;
  renderItem?: (props: {
    title: string;
    path: string;
    data: any;
  }) => React.ReactNode;
  style?: React.CSSProperties;
  search?: string;
  clearSearch?: (path: string) => void;
  mode?: "router" | "query";
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const contentNode = props.renderItem
    ? props.renderItem({
        title: props.title,
        path: props.path,
        data: props.data,
      })
    : props.title;

  const content =
    typeof contentNode === "string" ? (
      <Tooltip
        text={contentNode}
        truncated
        style={{ width: "100%" }}
        popupStyle={{
          padding: "var(--gutter-extra-small) var(--gutter-small)",
        }}
      >
        {renderStringWithSearch(contentNode, props.search)}
      </Tooltip>
    ) : (
      contentNode
    );

  if (props.mode === "query") {
    const isActive = searchParams.get("path") === props.path;

    return (
      <div
        className={classNames(styles.item, isActive && styles.active)}
        style={props.style}
        onClick={() => {
          setSearchParams({
            path: props.path,
          });
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <NavLink
      className={(props) =>
        classNames(styles.item, props.isActive && styles.active)
      }
      to={props.path}
      style={props.style}
      onClick={(ev) =>
        props.clearSearch?.(ev.currentTarget.getAttribute("href")!)
      }
    >
      {content}
    </NavLink>
  );
}

function Navigation(
  props: LayoutWithNavigationProps["navigation"] & {
    search?: string;
    clearSearch?: () => void;
  }
) {
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<List>(null);

  const [height, setHeight] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  const [shouldCollapseByDefault, setShouldCollapseByDefault] = useState(false);

  useEffect(() => {
    if (shouldCollapseByDefault) {
      setCollapsedGroups(
        props.items.map((item) => {
          return get(item, props.groupBy!.dataPath, "Other");
        })
      );
    }
  }, [props.items, shouldCollapseByDefault]);

  const onListScroll = useCallback(
    async (event: React.UIEvent<HTMLDivElement, UIEvent>) => {
      if (!props.lazyLoad) {
        return;
      }

      if (isFetching) {
        return;
      }

      const target = event.target as HTMLDivElement;

      if (
        target.scrollTop + target.clientHeight >= target.scrollHeight - 100 &&
        props.lazyLoad.hasMore
      ) {
        setIsFetching(true);

        try {
          await props.lazyLoad.loadMore();
        } catch {}

        setIsFetching(false);
      }
    },
    [props.lazyLoad?.hasMore, props.lazyLoad?.loadMore, isFetching]
  );

  const toggleGroup = useCallback(
    (groupName: string) => {
      setShouldCollapseByDefault(false);

      setCollapsedGroups((groups) => {
        if (groups.includes(groupName)) {
          return groups.filter((group) => group !== groupName);
        }

        return [...groups, groupName];
      });
    },
    [setCollapsedGroups]
  );

  useLayoutEffect(() => {
    if (ref.current) {
      setHeight(ref.current.clientHeight);
    }
  }, [ref.current]);

  const itemsToRender = useMemo(() => {
    if (props.search) {
      return props.items
        .filter((item) =>
          item.title.toLowerCase().includes(props.search!.toLowerCase())
        )
        .sort((a, b) => {
          const lengthA = props.search!.length / a.title.length;
          const lengthB = props.search!.length / b.title.length;

          return lengthB - lengthA;
        });
    }

    return props.items;
  }, [props.items, props.search]);

  const clearSearch = useCallback(() => {
    if (props.clearSearch) {
      props.clearSearch();
    }
  }, [props.clearSearch]);

  let result: React.ReactNode = null;

  if (props.groupBy) {
    result = (
      <>
        {itemsToRender
          .reduce((acc, item) => {
            const groupName = get(item, props.groupBy!.dataPath, "Other");
            let group = acc.find((group) => group.name === groupName);

            if (!group) {
              group = {
                name: groupName,
                items: [],
              };
              acc.push(group);
            }

            group.items.push(item);

            return acc;
          }, [] as { name: string; items: typeof props.items }[])
          .map((group) => {
            const isCollapsed = collapsedGroups.includes(group.name);

            return (
              <div
                key={group.name}
                className={classNames(
                  styles.group,
                  isCollapsed && styles.collapsed
                )}
              >
                <div
                  className={styles.title}
                  onClick={() => toggleGroup(group.name)}
                >
                  <Icon
                    className={styles.arrow}
                    icon={<ArrowDown />}
                    size={12}
                  />
                  {group.name}
                </div>
                {!isCollapsed && (
                  <div className={styles.list}>
                    {group.items.map((item) => (
                      <NavigationItem
                        {...item}
                        key={item.path}
                        renderItem={props.renderItem}
                        search={props.search}
                        clearSearch={clearSearch}
                        mode={props.mode}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </>
    );
  } else if (!props.virtualization?.enabled) {
    result = (
      <>
        {itemsToRender.map((item) => (
          <NavigationItem
            {...item}
            key={item.path}
            renderItem={props.renderItem}
            search={props.search}
            clearSearch={clearSearch}
            mode={props.mode}
          />
        ))}
      </>
    );
  } else {
    result = (
      <>
        <List
          ref={listRef}
          width={300}
          rowHeight={40}
          height={height}
          rowCount={itemsToRender.length}
          rowRenderer={({ index, key, style }) => (
            <div style={{ ...style, paddingBottom: 8 }}>
              <NavigationItem
                {...itemsToRender[index]}
                key={key}
                renderItem={props.renderItem}
                search={props.search}
                clearSearch={clearSearch}
                mode={props.mode}
              />
            </div>
          )}
        />
      </>
    );
  }

  return (
    <div className={styles.listContainer}>
      {!!props.groupBy && (
        <div className={styles.actions}>
          <Button
            variant={ButtonVariant.Text}
            onClick={() => {
              setShouldCollapseByDefault(false);

              setCollapsedGroups([]);

              queueMicrotask(() => {
                onListScroll({ target: ref.current! } as any);
              });
            }}
            disabled={collapsedGroups.length === 0}
          >
            <Icon icon={<Expand />} size={16} />
            Expand all
          </Button>
          <Button
            variant={ButtonVariant.Text}
            disabled={collapsedGroups.length === itemsToRender.length}
            onClick={() => {
              setShouldCollapseByDefault(true);

              setCollapsedGroups(
                itemsToRender.map((item) => {
                  return get(item, props.groupBy!.dataPath, "Other");
                })
              );

              queueMicrotask(() => {
                onListScroll({ target: ref.current! } as any);
              });
            }}
          >
            <Icon icon={<Collapse />} size={16} />
            Collapse all
          </Button>
        </div>
      )}
      <div
        className={classNames(
          styles.list,
          props.virtualization?.enabled && styles.virtualized
        )}
        ref={ref}
        onScroll={onListScroll}
      >
        {result}
        {props.lazyLoad?.hasMore && (
          <div className={styles.listLoader}>
            <Loader visible />
          </div>
        )}
      </div>
    </div>
  );
}

export function LayoutWithNavigation(props: LayoutWithNavigationProps) {
  const searchRef = useRef<TextInputRef>(null);
  const [search, setSearch] = useState("");

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);

      if (props.onSearch) {
        props.onSearch(value);
      }
    },
    [props.onSearch]
  );

  const clearSearch = useCallback(() => {
    setSearch("");

    if (props.onSearch) {
      props.onSearch("");
    }

    searchRef.current?.clear();
  }, [props.onSearch]);

  const debouncedHandleSearch = useMemo(
    () => debounce(handleSearch, 300),
    [handleSearch]
  );

  const [searchParams] = useSearchParams();

  return (
    <div className={classNames(styles.wrapper, props.className)}>
      {props.empty?.enabled && (
        <div className={styles.empty}>
          <Empty description={props.empty.message} />
        </div>
      )}
      {!props.empty?.enabled && (
        <>
          <div className={styles.navigation}>
            {props.search?.enabled && (
              <TextInput
                ref={searchRef}
                className={styles.search}
                placeholder="Search"
                prefix={<Icon icon={<IconSearch />} size={16} />}
                onChange={debouncedHandleSearch}
                clearBtn
              />
            )}
            {props.navigation.slot}
            {!props.loading && props.navigation.items.length === 0 ? (
              <div className={styles.empty}>Nothing to show</div>
            ) : (
              <Navigation
                {...props.navigation}
                search={search}
                clearSearch={clearSearch}
              />
            )}
            {props.loading && <Loader className={styles.loader} visible />}
          </div>
          <div className={styles.divider} />
          <div className={styles.content}>
            {!props.loading &&
              (typeof props.children === "function"
                ? props.children(searchParams.get("path") || "")
                : props.children)}
            {props.loading && <Loader className={styles.loader} visible />}
          </div>
        </>
      )}
    </div>
  );
}

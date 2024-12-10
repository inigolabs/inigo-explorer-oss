import "./Menu.scss";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import classNames from "classnames";
import { IMenuProps, IMenuRef, IOptionProps } from "./Menu.types";
import Icon, { IconCheck } from "../Icon/Icon";
import Button from "../Button/Button";
import Loader from "../Loader/Loader";
import { throttle } from "lodash";
import TextInput, { TextInputRef } from "../TextInput/TextInput";

const renderStringWithSearch = (
  value: string,
  searchValue?: string | RegExp | ((str: string) => boolean)
) => {
  if (!searchValue) {
    return value;
  }

  if (searchValue instanceof Function) {
    return searchValue(value) ? (
      <span className="SearchValue">{value}</span>
    ) : (
      value
    );
  }

  if (searchValue instanceof RegExp) {
    return (
      <span
        dangerouslySetInnerHTML={{
          __html: value.replace(
            searchValue,
            (match) => `<span class="SearchValue">${match}</span>`
          ),
        }}
      ></span>
    );
  }

  const index = value.toLowerCase().indexOf(searchValue?.toLowerCase());

  if (index === -1) {
    return value;
  }

  return (
    <>
      {value.slice(0, index)}
      <span className="SearchValue">
        {value.slice(index, index + searchValue.length)}
      </span>
      {value.slice(index + searchValue.length)}
    </>
  );
};

function Option(props: IOptionProps) {
  const { multiSelect, data = [], value, readOnly, children } = props;

  if (multiSelect) {
    const checked = data.some((r) => r === value);

    return (
      <div
        className={classNames(
          "MenuOption",
          {
            ReadOnly: readOnly,
            Disabled: props.disabled,
            IsButton: props.type === "button",
            Selected: props.isSelected || checked,
          },
          props.className
        )}
        tabIndex={0}
        onClick={(ev) => {
          ev.preventDefault();
          ev.stopPropagation();

          props.onClick?.(value);

          if (props.type === "button") {
          }
          (document.activeElement as HTMLElement)?.blur();
        }}
      >
        {props.type !== "button" && (
          <div
            className={classNames("Checkbox", {
              disabled: readOnly,
              checked,
            })}
          >
            {checked ? <Icon size={16} icon={<IconCheck />} /> : null}
            <input type="checkbox" />
          </div>
        )}
        {typeof children === "string" && props.searchValue
          ? renderStringWithSearch(children, props.searchValue)
          : children}
      </div>
    );
  }

  // if (props.href) {
  //   return (
  //     <Link
  //       tabIndex={0}
  //       to={props.href}
  //       className={classNames(
  //         "MenuOption",
  //         {
  //           ReadOnly: readOnly,
  //           Disabled: props.disabled,
  //           Selected: props.isSelected,
  //         },
  //         props.className
  //       )}
  //       onClick={(ev) => {
  //         ev.stopPropagation();

  //         ev.currentTarget.blur();
  //         props.onClick?.(value);
  //       }}
  //     >
  //       {typeof children === "string" && props.searchValue
  //         ? renderStringWithSearch(children, props.searchValue)
  //         : children}
  //     </Link>
  //   );
  // }
  if (props.render) {
    return <div>{props.render(props)}</div>;
  }

  return (
    <li
      tabIndex={0}
      className={classNames(
        "MenuOption",
        {
          ReadOnly: readOnly,
          Disabled: props.disabled,
          Selected: props.isSelected,
        },
        props.className
      )}
      onClick={(ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        ev.currentTarget.blur();
        props.onClick?.(value);
      }}
    >
      {typeof children === "string" && props.searchValue
        ? renderStringWithSearch(children, props.searchValue)
        : children}
    </li>
  );
}

const Menu = forwardRef<IMenuRef, IMenuProps>((props, ref) => {
  const targetRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLUListElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [optionsStyle, setOptionsStyle] = useState<React.CSSProperties>();
  const [options, _setOptions] = useState<React.ReactElement<IOptionProps>[]>(
    []
  );

  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(false);

  const searchRef = useRef<TextInputRef>(null);

  useEffect(() => {
    if (props.onSearch) {
      props.onSearch(searchValue);
    }
  }, [searchValue]);

  useEffect(() => {
    props.onActiveChange?.(isVisible);
  }, [isVisible]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      targetRef?.current?.focus();
    },
    focusSearch: () => {
      searchRef?.current?.focus?.();
    },
  }));

  useEffect(() => {
    function onMouseWheel(ev: Event) {
      if (targetRef.current?.children[0] === document.activeElement) {
        if (ev.composedPath().some((el) => el === optionsRef.current)) {
          return;
        }

        setTimeout(() => {
          (targetRef.current?.children[0] as HTMLElement)?.blur();
        }, 100);

        setIsVisible(false);
      }
    }

    window.addEventListener("mousewheel", onMouseWheel);

    return () => {
      window.removeEventListener("mousewheel", onMouseWheel);
    };
  }, [targetRef, optionsRef]);

  const setOptions = (
    children: IMenuProps["children"],
    force = false,
    search?: string
  ) => {
    if (children) {
      let result: React.ReactElement<IOptionProps>[] = Array.isArray(children)
        ? children
        : [children];

      if (result) {
        if (props.multiSelect && options.length && !force) {
          result = options.map((option) =>
            result.find((child) => child.props.value === option.props.value)
          ) as React.ReactElement<IOptionProps>[];
        }

        _setOptions(
          React.Children.map(
            result ?? [],
            (child: React.ReactElement<IOptionProps>, index) => {
              if (React.isValidElement(child)) {
                return React.cloneElement(child, {
                  key: index,
                  ...(props?.multiSelect && {
                    multiSelect: props.multiSelect,
                  }),
                  data: props.data,
                  searchValue: search,
                  isSelected:
                    props.value === child.props.value ||
                    props.data?.includes(child.props.value as string),
                  onClick: (value: unknown) => {
                    if (!child.props.readOnly) {
                      props.onSelect?.(value, child.props);

                      // if (search) {
                      //   searchRef?.current?.focus?.();
                      // }

                      if (props.trigger === "hover") {
                        setIsVisible(false);
                      }
                    }
                  },
                });
              }

              return child;
            }
          ).sort((a, b) => {
            if (props.ignoreSelectedSort) {
              return 0;
            }

            const isASelected = a.props.isSelected;
            const isBSelected = b.props.isSelected;

            if (isASelected && !isBSelected) {
              return -1;
            } else if (!isASelected && isBSelected) {
              return 1;
            }

            return 0;
          })
        );
      }
    } else {
      _setOptions([]);
    }
  };

  useEffect(() => {
    setOptions(props.children);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.children]);

  const [lastFetchedChildren, setLastFetchedChildren] = useState<
    IMenuProps["children"]
  >([]);

  const fetchOptions = useMemo(() => {
    if (props.fetchOptions) {
      return throttle((value: string) => {
        setLoading(true);

        return props.fetchOptions!(value).then((result) => {
          setOptions(result, false, value);
          setLastFetchedChildren(result);
          setLoading(false);
        });
      }, 1000);
    }
  }, []);

  useEffect(() => {
    setOptions(props.children ?? lastFetchedChildren, false, searchValue);
  }, [props.data, props.value]);

  useEffect(() => {
    if (fetchOptions) {
      fetchOptions(searchValue);
    } else {
      setOptions(props.children, false, searchValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue, props.search, props.autoComplete, fetchOptions]);

  const sortSelectedChildren = (children: IMenuProps["children"]) => {
    if (children) {
      children = Array.isArray(children) ? children : [children];

      return [...(children as React.ReactElement[])].sort((a, b) => {
        if (a.props?.type === "button" || b.props?.type === "button") {
          return 0;
        }

        if (
          props.data?.includes(a.props?.value as string) &&
          !props.data?.includes(b.props?.value as string)
        ) {
          return -1;
        } else if (
          !props.data?.includes(a.props?.value as string) &&
          props.data?.includes(b.props?.value as string)
        ) {
          return 1;
        }

        return 0;
      });
    }

    return [];
  };

  const handleOptionsStyle = () => {
    const { current: targetEl } = targetRef;
    const { current: optionsEl } = optionsRef;

    if (targetEl && optionsEl) {
      const optionsRect = optionsEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      if (props.position === "left") {
        let top = targetRect.top;

        if (top + optionsRect.height > window.innerHeight) {
          top = window.innerHeight - optionsRect.height;
        }

        setOptionsStyle({
          right: window.innerWidth - targetRect.right + optionsRect.width + 2,
          top,
          minWidth: props.minWidth ?? targetRect.width,
        });
      } else {
        let top = targetRect.bottom + 2;

        if (top + optionsRect.height > window.innerHeight) {
          top = targetRect.top - optionsRect.height;
        }

        if (props.placement === "right") {
          setOptionsStyle({
            right: window.innerWidth - targetRect.right,
            top,
            minWidth: props.minWidth ?? targetRect.width,
          });
        } else {
          setOptionsStyle({
            left: targetRect.left,
            top,
            minWidth: props.minWidth ?? targetRect.width,
          });
        }
      }
    }
  };

  useEffect(() => {
    const { current: optionsEl } = optionsRef;

    function handleTransitionStart(ev: TransitionEvent) {
      if (ev.target === optionsEl) {
        const { opacity } = window.getComputedStyle(
          ev.target as HTMLUListElement
        );

        if (Number(opacity) > 0 && Number(opacity) < 1) {
          setOptions(
            sortSelectedChildren(props.children ?? lastFetchedChildren),
            true,
            searchValue
          );
        }
      }
    }

    if (props.multiSelect) {
      if (optionsEl) {
        optionsEl.addEventListener("transitionstart", handleTransitionStart);

        return () =>
          optionsEl.removeEventListener(
            "transitionstart",
            handleTransitionStart
          );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    optionsRef,
    props.data,
    props.children,
    lastFetchedChildren,
    searchValue,
  ]);

  useEffect(() => {
    handleOptionsStyle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRef]);

  const renderMultiSelect = (): React.ReactElement => {
    return (
      <>
        <div className="MenuSearch">
          <TextInput
            ref={searchRef}
            clearBtn
            placeholder={props.placeholder ?? "Search"}
            onEnterPress={() => {
              if (props.autoComplete) {
                props.onSelect?.(searchValue, null);
                (document.activeElement as HTMLElement)?.blur();
              }
            }}
            value={searchValue}
            onChange={setSearchValue}
          />
        </div>
        <div className="MenuOptionWrapper">
          {!!optionsToRender.length && !loading && optionsToRender}
          {!optionsToRender.length && (
            <div className="MenuOptionWrapperEmpty">
              <img
                alt=""
                height={55}
                src={
                  props.theme === "dark"
                    ? "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgyIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDE4MiAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjkxIiBjeT0iNjAiIHI9IjYwIiBmaWxsPSIjMUYxRjFGIi8+CjxyZWN0IHg9IjM5IiB5PSI4OCIgd2lkdGg9IjEwNCIgaGVpZ2h0PSIzIiByeD0iMS41IiBmaWxsPSIjMzM1NjlCIi8+CjxyZWN0IHg9IjU0IiB5PSIzNCIgd2lkdGg9Ijc0IiBoZWlnaHQ9IjQyIiByeD0iMyIgZmlsbD0iIzMzMzMzMyIgc3Ryb2tlPSIjMzc3RkZEIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik05MS4wMDIxIDgyLjE5NDJDOTIuNDAxMiA4Mi4xOTQyIDkzLjUzNTQgODEuMDYyIDkzLjUzNTQgNzkuNjY1NUM5My41MzU0IDc4LjI2ODkgOTIuNDAxMiA3Ny4xMzY3IDkxLjAwMjEgNzcuMTM2N0M4OS42MDMgNzcuMTM2NyA4OC40Njg4IDc4LjI2ODkgODguNDY4OCA3OS42NjU1Qzg4LjQ2ODggODEuMDYyIDg5LjYwMyA4Mi4xOTQyIDkxLjAwMjEgODIuMTk0MlpNODEuMzI2IDgzLjAwOThDNzkuMTIyMyA4My4wMDk4IDc3LjMzNTkgODQuNzk2MiA3Ny4zMzU5IDg2Ljk5OThIMTA1LjMxN0MxMDUuMzE3IDg0Ljc5NjIgMTAzLjUzMSA4My4wMDk4IDEwMS4zMjcgODMuMDA5OEg4MS4zMjZaIiBmaWxsPSIjMzMzMzMzIi8+CjxwYXRoIGQ9Ik03Ny4zMzU5IDg2Ljk5OThINzYuMzM1OVY4Ny45OTk4SDc3LjMzNTlWODYuOTk5OFpNMTA1LjMxNyA4Ni45OTk4Vjg3Ljk5OThIMTA2LjMxN1Y4Ni45OTk4SDEwNS4zMTdaTTkyLjUzNTQgNzkuNjY1NUM5Mi41MzU0IDgwLjUwOCA5MS44NTA2IDgxLjE5NDIgOTEuMDAyMSA4MS4xOTQyVjgzLjE5NDJDOTIuOTUxOCA4My4xOTQyIDk0LjUzNTQgODEuNjE2IDk0LjUzNTQgNzkuNjY1NUg5Mi41MzU0Wk05MS4wMDIxIDc4LjEzNjdDOTEuODUwNiA3OC4xMzY3IDkyLjUzNTQgNzguODIyOSA5Mi41MzU0IDc5LjY2NTVIOTQuNTM1NEM5NC41MzU0IDc3LjcxNDkgOTIuOTUxOCA3Ni4xMzY3IDkxLjAwMjEgNzYuMTM2N1Y3OC4xMzY3Wk04OS40Njg4IDc5LjY2NTVDODkuNDY4OCA3OC44MjI5IDkwLjE1MzUgNzguMTM2NyA5MS4wMDIxIDc4LjEzNjdWNzYuMTM2N0M4OS4wNTI0IDc2LjEzNjcgODcuNDY4OCA3Ny43MTQ5IDg3LjQ2ODggNzkuNjY1NUg4OS40Njg4Wk05MS4wMDIxIDgxLjE5NDJDOTAuMTUzNSA4MS4xOTQyIDg5LjQ2ODggODAuNTA4IDg5LjQ2ODggNzkuNjY1NUg4Ny40Njg4Qzg3LjQ2ODggODEuNjE2IDg5LjA1MjQgODMuMTk0MiA5MS4wMDIxIDgzLjE5NDJWODEuMTk0MlpNNzguMzM1OSA4Ni45OTk4Qzc4LjMzNTkgODUuMzQ4NSA3OS42NzQ2IDg0LjAwOTggODEuMzI2IDg0LjAwOThWODIuMDA5OEM3OC41NzAxIDgyLjAwOTggNzYuMzM1OSA4NC4yNDM5IDc2LjMzNTkgODYuOTk5OEg3OC4zMzU5Wk0xMDUuMzE3IDg1Ljk5OThINzcuMzM1OVY4Ny45OTk4SDEwNS4zMTdWODUuOTk5OFpNMTAxLjMyNyA4NC4wMDk4QzEwMi45NzggODQuMDA5OCAxMDQuMzE3IDg1LjM0ODUgMTA0LjMxNyA4Ni45OTk4SDEwNi4zMTdDMTA2LjMxNyA4NC4yNDM5IDEwNC4wODMgODIuMDA5OCAxMDEuMzI3IDgyLjAwOThWODQuMDA5OFpNODEuMzI2IDg0LjAwOThIMTAxLjMyN1Y4Mi4wMDk4SDgxLjMyNlY4NC4wMDk4WiIgZmlsbD0iIzM3N0ZGRCIvPgo8cmVjdCB4PSI3OS41IiB5PSI0MC41IiB3aWR0aD0iMjMiIGhlaWdodD0iMjkiIHJ4PSIzLjUiIGZpbGw9IiM4QkIzRkEiIHN0cm9rZT0iIzM3N0ZGRCIvPgo8cmVjdCB4PSI4MiIgeT0iNDQiIHdpZHRoPSIxNSIgaGVpZ2h0PSIxLjUiIHJ4PSIwLjc1IiBmaWxsPSIjMUYxRjFGIi8+CjxyZWN0IHg9IjgyIiB5PSI0OS4xMjUiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxLjUiIHJ4PSIwLjc1IiBmaWxsPSJ3aGl0ZSIvPgo8cmVjdCB4PSI4MiIgeT0iNTQuMjUiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxLjUiIHJ4PSIwLjc1IiBmaWxsPSJ3aGl0ZSIvPgo8cmVjdCB4PSI4MiIgeT0iNTkuMzc1IiB3aWR0aD0iMTgiIGhlaWdodD0iMS41IiByeD0iMC43NSIgZmlsbD0id2hpdGUiLz4KPHJlY3QgeD0iODIiIHk9IjY0LjUiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxLjUiIHJ4PSIwLjc1IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTEwMy40NTggOTEuNzc2OEMxMDcuNjc0IDkxLjc3NjggMTExLjU5MiA5MC41MDU4IDExNC44NDcgODguMzI3MUwxMjguMTY5IDEwMS4wMDFMMTMzIDk1LjQxNDJMMTIwLjE0NSA4My4xODQ2QzEyMi41MTkgNzkuODU0OSAxMjMuOTE1IDc1Ljc4NDEgMTIzLjkxNSA3MS4zODg0QzEyMy45MTUgNjAuMTI4MiAxMTQuNzU2IDUxIDEwMy40NTggNTFDOTIuMTU5MSA1MSA4MyA2MC4xMjgyIDgzIDcxLjM4ODRDODMgODIuNjQ4NiA5Mi4xNTkxIDkxLjc3NjggMTAzLjQ1OCA5MS43NzY4Wk0xMjAuOTA1IDcxLjM4OEMxMjAuOTA1IDgwLjkyMSAxMTMuMTUxIDg4LjY0OTEgMTAzLjU4NSA4OC42NDkxQzk0LjAxOTkgODguNjQ5MSA4Ni4yNjU2IDgwLjkyMSA4Ni4yNjU2IDcxLjM4OEM4Ni4yNjU2IDYxLjg1NSA5NC4wMTk5IDU0LjEyNyAxMDMuNTg1IDU0LjEyN0MxMTMuMTUxIDU0LjEyNyAxMjAuOTA1IDYxLjg1NSAxMjAuOTA1IDcxLjM4OFoiIGZpbGw9IiMxNDY3RjgiLz4KPGcgZmlsdGVyPSJ1cmwoI2ZpbHRlcjBfYl8xNjc2N183MTE5MikiPgo8cGF0aCBkPSJNMTAzLjQzNiA4OC44MjI3QzExMy4yMTYgODguODIyNyAxMjEuMTQ1IDgwLjk2OTYgMTIxLjE0NSA3MS4yODI0QzEyMS4xNDUgNjEuNTk1MiAxMTMuMjE2IDUzLjc0MjIgMTAzLjQzNiA1My43NDIyQzkzLjY1NTEgNTMuNzQyMiA4NS43MjY2IDYxLjU5NTIgODUuNzI2NiA3MS4yODI0Qzg1LjcyNjYgODAuOTY5NiA5My42NTUxIDg4LjgyMjcgMTAzLjQzNiA4OC44MjI3WiIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4zIi8+CjwvZz4KPHBhdGggZD0iTTEyNy44NCAxMDAuNzg5TDEzMi42MzYgOTUuMjI2NUwxMzMuMzU4IDk1LjkxNThDMTM0LjA1OSA5Ni41ODQ2IDEzNC40NzkgOTcuNTE5IDEzNC41MjUgOTguNTEzM0MxMzQuNTcxIDk5LjUwNzcgMTM0LjI0IDEwMC40ODEgMTMzLjYwNCAxMDEuMjE4QzEzMi45NjggMTAxLjk1NSAxMzIuMDggMTAyLjM5NyAxMzEuMTM1IDEwMi40NDVDMTMwLjE5IDEwMi40OTQgMTI5LjI2NSAxMDIuMTQ1IDEyOC41NjQgMTAxLjQ3NkwxMjcuODQyIDEwMC43ODdMMTI3Ljg0IDEwMC43ODlaIiBmaWxsPSIjODRBQ0YzIi8+CjxkZWZzPgo8ZmlsdGVyIGlkPSJmaWx0ZXIwX2JfMTY3NjdfNzExOTIiIHg9IjgyLjcyNjYiIHk9IjUwLjc0MjIiIHdpZHRoPSI0MS40MTgiIGhlaWdodD0iNDEuMDgyIiBmaWx0ZXJVbml0cz0idXNlclNwYWNlT25Vc2UiIGNvbG9yLWludGVycG9sYXRpb24tZmlsdGVycz0ic1JHQiI+CjxmZUZsb29kIGZsb29kLW9wYWNpdHk9IjAiIHJlc3VsdD0iQmFja2dyb3VuZEltYWdlRml4Ii8+CjxmZUdhdXNzaWFuQmx1ciBpbj0iQmFja2dyb3VuZEltYWdlRml4IiBzdGREZXZpYXRpb249IjEuNSIvPgo8ZmVDb21wb3NpdGUgaW4yPSJTb3VyY2VBbHBoYSIgb3BlcmF0b3I9ImluIiByZXN1bHQ9ImVmZmVjdDFfYmFja2dyb3VuZEJsdXJfMTY3NjdfNzExOTIiLz4KPGZlQmxlbmQgbW9kZT0ibm9ybWFsIiBpbj0iU291cmNlR3JhcGhpYyIgaW4yPSJlZmZlY3QxX2JhY2tncm91bmRCbHVyXzE2NzY3XzcxMTkyIiByZXN1bHQ9InNoYXBlIi8+CjwvZmlsdGVyPgo8L2RlZnM+Cjwvc3ZnPgo="
                    : "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgyIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDE4MiAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjkxIiBjeT0iNjAiIHI9IjYwIiBmaWxsPSIjRURGM0ZCIi8+CjxyZWN0IHg9IjM5IiB5PSI4OCIgd2lkdGg9IjEwNCIgaGVpZ2h0PSIzIiByeD0iMS41IiBmaWxsPSIjODRBQ0YzIi8+CjxtYXNrIGlkPSJwYXRoLTMtaW5zaWRlLTFfMTMzNTFfMTAzOTY3IiBmaWxsPSJ3aGl0ZSI+CjxyZWN0IHg9IjUzIiB5PSIzMyIgd2lkdGg9Ijc2IiBoZWlnaHQ9IjQ0IiByeD0iMiIvPgo8L21hc2s+CjxyZWN0IHg9IjUzIiB5PSIzMyIgd2lkdGg9Ijc2IiBoZWlnaHQ9IjQ0IiByeD0iMiIgZmlsbD0iI0VERjNGQiIgc3Ryb2tlPSIjMzc3RkZEIiBzdHJva2Utd2lkdGg9IjYiIG1hc2s9InVybCgjcGF0aC0zLWluc2lkZS0xXzEzMzUxXzEwMzk2NykiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik05MS4wMDIxIDgyLjE5NDJDOTIuNDAxMiA4Mi4xOTQyIDkzLjUzNTQgODEuMDYyIDkzLjUzNTQgNzkuNjY1NUM5My41MzU0IDc4LjI2ODkgOTIuNDAxMiA3Ny4xMzY3IDkxLjAwMjEgNzcuMTM2N0M4OS42MDMgNzcuMTM2NyA4OC40Njg4IDc4LjI2ODkgODguNDY4OCA3OS42NjU1Qzg4LjQ2ODggODEuMDYyIDg5LjYwMyA4Mi4xOTQyIDkxLjAwMjEgODIuMTk0MlpNODEuMzI2IDgzLjAwOThDNzkuMTIyMyA4My4wMDk4IDc3LjMzNTkgODQuNzk2MiA3Ny4zMzU5IDg2Ljk5OThIMTA1LjMxN0MxMDUuMzE3IDg0Ljc5NjIgMTAzLjUzMSA4My4wMDk4IDEwMS4zMjcgODMuMDA5OEg4MS4zMjZaIiBmaWxsPSIjRURGM0ZCIi8+CjxwYXRoIGQ9Ik03Ny4zMzU5IDg2Ljk5OThINzYuMzM1OVY4Ny45OTk4SDc3LjMzNTlWODYuOTk5OFpNMTA1LjMxNyA4Ni45OTk4Vjg3Ljk5OThIMTA2LjMxN1Y4Ni45OTk4SDEwNS4zMTdaTTkyLjUzNTQgNzkuNjY1NUM5Mi41MzU0IDgwLjUwOCA5MS44NTA2IDgxLjE5NDIgOTEuMDAyMSA4MS4xOTQyVjgzLjE5NDJDOTIuOTUxOCA4My4xOTQyIDk0LjUzNTQgODEuNjE2IDk0LjUzNTQgNzkuNjY1NUg5Mi41MzU0Wk05MS4wMDIxIDc4LjEzNjdDOTEuODUwNiA3OC4xMzY3IDkyLjUzNTQgNzguODIyOSA5Mi41MzU0IDc5LjY2NTVIOTQuNTM1NEM5NC41MzU0IDc3LjcxNDkgOTIuOTUxOCA3Ni4xMzY3IDkxLjAwMjEgNzYuMTM2N1Y3OC4xMzY3Wk04OS40Njg4IDc5LjY2NTVDODkuNDY4OCA3OC44MjI5IDkwLjE1MzUgNzguMTM2NyA5MS4wMDIxIDc4LjEzNjdWNzYuMTM2N0M4OS4wNTI0IDc2LjEzNjcgODcuNDY4OCA3Ny43MTQ5IDg3LjQ2ODggNzkuNjY1NUg4OS40Njg4Wk05MS4wMDIxIDgxLjE5NDJDOTAuMTUzNSA4MS4xOTQyIDg5LjQ2ODggODAuNTA4IDg5LjQ2ODggNzkuNjY1NUg4Ny40Njg4Qzg3LjQ2ODggODEuNjE2IDg5LjA1MjQgODMuMTk0MiA5MS4wMDIxIDgzLjE5NDJWODEuMTk0MlpNNzguMzM1OSA4Ni45OTk4Qzc4LjMzNTkgODUuMzQ4NSA3OS42NzQ2IDg0LjAwOTggODEuMzI2IDg0LjAwOThWODIuMDA5OEM3OC41NzAxIDgyLjAwOTggNzYuMzM1OSA4NC4yNDM5IDc2LjMzNTkgODYuOTk5OEg3OC4zMzU5Wk0xMDUuMzE3IDg1Ljk5OThINzcuMzM1OVY4Ny45OTk4SDEwNS4zMTdWODUuOTk5OFpNMTAxLjMyNyA4NC4wMDk4QzEwMi45NzggODQuMDA5OCAxMDQuMzE3IDg1LjM0ODUgMTA0LjMxNyA4Ni45OTk4SDEwNi4zMTdDMTA2LjMxNyA4NC4yNDM5IDEwNC4wODMgODIuMDA5OCAxMDEuMzI3IDgyLjAwOThWODQuMDA5OFpNODEuMzI2IDg0LjAwOThIMTAxLjMyN1Y4Mi4wMDk4SDgxLjMyNlY4NC4wMDk4WiIgZmlsbD0iIzM3N0ZGRCIvPgo8cmVjdCB4PSI3OS43NSIgeT0iNDAuNzUiIHdpZHRoPSIyMi41IiBoZWlnaHQ9IjI4LjUiIHJ4PSIyLjI1IiBmaWxsPSIjOEJCM0ZBIiBzdHJva2U9IiMzNzdGRkQiIHN0cm9rZS13aWR0aD0iMS41Ii8+CjxyZWN0IHg9IjgxLjY2OCIgeT0iNDQuNDEyMSIgd2lkdGg9IjE1IiBoZWlnaHQ9IjEiIHJ4PSIwLjUiIGZpbGw9IiMwNDI4NjYiLz4KPHJlY3QgeD0iODEuNjY4IiB5PSI0OS42Nzc3IiB3aWR0aD0iMTguNjY2NyIgaGVpZ2h0PSIxIiByeD0iMC41IiBmaWxsPSJ3aGl0ZSIvPgo8cmVjdCB4PSI4MS42NjgiIHk9IjU0Ljk0MTQiIHdpZHRoPSIxOC42NjY3IiBoZWlnaHQ9IjEiIHJ4PSIwLjUiIGZpbGw9IndoaXRlIi8+CjxyZWN0IHg9IjgxLjY2OCIgeT0iNjAuMjA3IiB3aWR0aD0iMTguNjY2NyIgaGVpZ2h0PSIxIiByeD0iMC41IiBmaWxsPSJ3aGl0ZSIvPgo8cmVjdCB4PSI4MS42NjgiIHk9IjY1LjQ3MDciIHdpZHRoPSIxOC42NjY3IiBoZWlnaHQ9IjEiIHJ4PSIwLjUiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNOTkuMzY5NiA4Ni42MjE4QzEwMi45NDkgODYuNjIxOCAxMDYuMjc2IDg1LjU0MjUgMTA5LjA0MSA4My42OTI1TDEyMC4zNTIgOTQuNDUzM0wxMjQuNDU0IDg5LjcxMDFMMTEzLjUzOSA3OS4zMjYxQzExNS41NTQgNzYuNDk5IDExNi43MzkgNzMuMDQyOSAxMTYuNzM5IDY5LjMxMDlDMTE2LjczOSA1OS43NTA0IDEwOC45NjMgNTIgOTkuMzY5NiA1MkM4OS43NzY2IDUyIDgyIDU5Ljc1MDQgODIgNjkuMzEwOUM4MiA3OC44NzE1IDg5Ljc3NjYgODYuNjIxOCA5OS4zNjk2IDg2LjYyMThaTTExNC4xODQgNjkuMzA5OUMxMTQuMTg0IDc3LjQwNCAxMDcuNiA4My45NjU1IDk5LjQ3ODcgODMuOTY1NUM5MS4zNTcyIDgzLjk2NTUgODQuNzczNCA3Ny40MDQgODQuNzczNCA2OS4zMDk5Qzg0Ljc3MzQgNjEuMjE1OCA5MS4zNTcyIDU0LjY1NDMgOTkuNDc4NyA1NC42NTQzQzEwNy42IDU0LjY1NDMgMTE0LjE4NCA2MS4yMTU4IDExNC4xODQgNjkuMzA5OVoiIGZpbGw9IiMxNDY3RjgiLz4KPGcgZmlsdGVyPSJ1cmwoI2ZpbHRlcjBfYl8xMzM1MV8xMDM5NjcpIj4KPHBhdGggZD0iTTk5LjM1MjMgODQuMTEzNEMxMDcuNjU2IDg0LjExMzQgMTE0LjM4OCA3Ny40NDU3IDExNC4zODggNjkuMjIwOEMxMTQuMzg4IDYwLjk5NTggMTA3LjY1NiA1NC4zMjgxIDk5LjM1MjMgNTQuMzI4MUM5MS4wNDgyIDU0LjMyODEgODQuMzE2NCA2MC45OTU4IDg0LjMxNjQgNjkuMjIwOEM4NC4zMTY0IDc3LjQ0NTcgOTEuMDQ4MiA4NC4xMTM0IDk5LjM1MjMgODQuMTEzNFoiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMyIvPgo8L2c+CjxwYXRoIGQ9Ik0xMjAuMDcgOTQuMjczNEwxMjQuMTQyIDg5LjU1MDVMMTI0Ljc1NiA5MC4xMzU4QzEyNS4zNTEgOTAuNzAzNiAxMjUuNzA3IDkxLjQ5NyAxMjUuNzQ2IDkyLjM0MTJDMTI1Ljc4NSA5My4xODU1IDEyNS41MDQgOTQuMDExNSAxMjQuOTY0IDk0LjYzNzVDMTI0LjQyNSA5NS4yNjM2IDEyMy42NyA5NS42Mzg0IDEyMi44NjggOTUuNjc5NkMxMjIuMDY1IDk1LjcyMDcgMTIxLjI4IDk1LjQyNDggMTIwLjY4NSA5NC44NTY5TDEyMC4wNzIgOTQuMjcxNkwxMjAuMDcgOTQuMjczNFoiIGZpbGw9IiMwNDI4NjYiLz4KPGRlZnM+CjxmaWx0ZXIgaWQ9ImZpbHRlcjBfYl8xMzM1MV8xMDM5NjciIHg9IjgxLjMxNjQiIHk9IjUxLjMyODEiIHdpZHRoPSIzNi4wNzAzIiBoZWlnaHQ9IjM1Ljc4NTIiIGZpbHRlclVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgY29sb3ItaW50ZXJwb2xhdGlvbi1maWx0ZXJzPSJzUkdCIj4KPGZlRmxvb2QgZmxvb2Qtb3BhY2l0eT0iMCIgcmVzdWx0PSJCYWNrZ3JvdW5kSW1hZ2VGaXgiLz4KPGZlR2F1c3NpYW5CbHVyIGluPSJCYWNrZ3JvdW5kSW1hZ2VGaXgiIHN0ZERldmlhdGlvbj0iMS41Ii8+CjxmZUNvbXBvc2l0ZSBpbjI9IlNvdXJjZUFscGhhIiBvcGVyYXRvcj0iaW4iIHJlc3VsdD0iZWZmZWN0MV9iYWNrZ3JvdW5kQmx1cl8xMzM1MV8xMDM5NjciLz4KPGZlQmxlbmQgbW9kZT0ibm9ybWFsIiBpbj0iU291cmNlR3JhcGhpYyIgaW4yPSJlZmZlY3QxX2JhY2tncm91bmRCbHVyXzEzMzUxXzEwMzk2NyIgcmVzdWx0PSJzaGFwZSIvPgo8L2ZpbHRlcj4KPC9kZWZzPgo8L3N2Zz4K"
                }
              />
              No available option
            </div>
          )}
          {!optionsToRender.length && loading && (
            <Loader visible={!optionsToRender.length && loading} />
          )}
        </div>
        {!!optionsToRender.length && (
          <div className="MenuFooter">
            <Button
              label="Apply"
              type="ghost"
              onClick={() => {
                (document.activeElement as HTMLElement)?.blur();
              }}
            />
            <Button
              label="Clear All"
              onClick={() => {
                props.onClear?.();
              }}
              disabled={!props.data?.length}
              type="link"
            />
          </div>
        )}
      </>
    );
  };

  // useEffect(() => {
  //   if (isVisible) {
  //     searchRef?.current?.focus();
  //   }
  // }, [isVisible]);

  const optionsToRender =
    searchValue && !props.fetchOptions
      ? options.filter((opt) => {
          if (typeof opt?.props?.children === "string") {
            if (
              searchValue &&
              opt?.props?.children
                ?.toLowerCase()
                .includes(`${searchValue}`.toLowerCase())
            ) {
              return opt;
            }
          } else if (typeof opt?.props?.value === "string") {
            if (
              searchValue &&
              opt?.props?.value
                ?.toLowerCase()
                .includes(`${searchValue}`.toLowerCase())
            ) {
              return opt;
            }
          }
          return false;
        })
      : options;

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const target = useMemo(() => {
    if (typeof props.target === "function") {
      return props.target(isVisible);
    }

    return props.target;
  }, [props.target, isVisible]);

  return (
    <div
      className={classNames(
        "Menu",
        {
          [props.placement ?? "left"]: true,
          [props.trigger ?? "focus"]: true,
          visible: isVisible,
          autoComplete: props.autoComplete,
          ShouldNotRenderSearchResult: optionsToRender.length <= 1,
        },
        props.className
      )}
      onMouseEnter={() => {
        if (props.trigger === "hover") {
          clearTimeout(timeoutRef.current);

          handleOptionsStyle();
          setIsVisible(true);
        }
      }}
      onMouseLeave={() => {
        if (props.trigger === "hover") {
          timeoutRef.current = setTimeout(() => {
            setIsVisible(false);
          }, 500);
        }
      }}
      onFocus={() => {
        if (props.trigger === "hover") {
          return;
        }
        handleOptionsStyle();
        setIsVisible(true);
      }}
    >
      <div
        ref={targetRef}
        onClick={(ev) => {
          if (props.trigger === "hover") {
            return;
          }

          ev.stopPropagation();
          ev.preventDefault();
        }}
        onMouseDown={(ev) => {
          if (props.trigger === "hover") {
            return;
          }

          ev.stopPropagation();

          if (targetRef.current?.children[0] === document.activeElement) {
            setTimeout(() => {
              (targetRef.current?.children[0] as HTMLElement)?.blur();
            }, 100);

            setIsVisible(false);
          } else {
            handleOptionsStyle();
            setIsVisible(true);
          }
        }}
      >
        {target}
      </div>
      <ul
        className={classNames("Options", { disabled: props.disabled })}
        style={optionsStyle ? optionsStyle : { opacity: 0 }}
        ref={optionsRef}
        onTransitionEnd={(ev) => {
          const { opacity } = window.getComputedStyle(ev.currentTarget);

          if (!+opacity) {
            setIsVisible(false);
            props.onBlur?.(undefined);
          }
        }}
      >
        {props?.multiSelect ? (
          renderMultiSelect()
        ) : (
          <>
            {props.search && (
              <div className="MenuSearch">
                <TextInput
                  ref={searchRef}
                  clearBtn
                  placeholder={props.placeholder ?? "Search"}
                  onEnterPress={() => {
                    if (props.autoComplete) {
                      props.onSelect?.(searchValue, null);
                      (document.activeElement as HTMLElement)?.blur();
                    }
                  }}
                  value={searchValue}
                  onChange={setSearchValue}
                />
              </div>
            )}
            <div className="MenuOptionWrapper">
              {!!optionsToRender.length && optionsToRender}
              {!optionsToRender.length && !props.autoComplete && (
                <div className="MenuOptionWrapperEmpty">
                  <img
                    alt=""
                    height={55}
                    src={
                      props.theme === "dark"
                        ? "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgyIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDE4MiAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjkxIiBjeT0iNjAiIHI9IjYwIiBmaWxsPSIjMUYxRjFGIi8+CjxyZWN0IHg9IjM5IiB5PSI4OCIgd2lkdGg9IjEwNCIgaGVpZ2h0PSIzIiByeD0iMS41IiBmaWxsPSIjMzM1NjlCIi8+CjxyZWN0IHg9IjU0IiB5PSIzNCIgd2lkdGg9Ijc0IiBoZWlnaHQ9IjQyIiByeD0iMyIgZmlsbD0iIzMzMzMzMyIgc3Ryb2tlPSIjMzc3RkZEIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik05MS4wMDIxIDgyLjE5NDJDOTIuNDAxMiA4Mi4xOTQyIDkzLjUzNTQgODEuMDYyIDkzLjUzNTQgNzkuNjY1NUM5My41MzU0IDc4LjI2ODkgOTIuNDAxMiA3Ny4xMzY3IDkxLjAwMjEgNzcuMTM2N0M4OS42MDMgNzcuMTM2NyA4OC40Njg4IDc4LjI2ODkgODguNDY4OCA3OS42NjU1Qzg4LjQ2ODggODEuMDYyIDg5LjYwMyA4Mi4xOTQyIDkxLjAwMjEgODIuMTk0MlpNODEuMzI2IDgzLjAwOThDNzkuMTIyMyA4My4wMDk4IDc3LjMzNTkgODQuNzk2MiA3Ny4zMzU5IDg2Ljk5OThIMTA1LjMxN0MxMDUuMzE3IDg0Ljc5NjIgMTAzLjUzMSA4My4wMDk4IDEwMS4zMjcgODMuMDA5OEg4MS4zMjZaIiBmaWxsPSIjMzMzMzMzIi8+CjxwYXRoIGQ9Ik03Ny4zMzU5IDg2Ljk5OThINzYuMzM1OVY4Ny45OTk4SDc3LjMzNTlWODYuOTk5OFpNMTA1LjMxNyA4Ni45OTk4Vjg3Ljk5OThIMTA2LjMxN1Y4Ni45OTk4SDEwNS4zMTdaTTkyLjUzNTQgNzkuNjY1NUM5Mi41MzU0IDgwLjUwOCA5MS44NTA2IDgxLjE5NDIgOTEuMDAyMSA4MS4xOTQyVjgzLjE5NDJDOTIuOTUxOCA4My4xOTQyIDk0LjUzNTQgODEuNjE2IDk0LjUzNTQgNzkuNjY1NUg5Mi41MzU0Wk05MS4wMDIxIDc4LjEzNjdDOTEuODUwNiA3OC4xMzY3IDkyLjUzNTQgNzguODIyOSA5Mi41MzU0IDc5LjY2NTVIOTQuNTM1NEM5NC41MzU0IDc3LjcxNDkgOTIuOTUxOCA3Ni4xMzY3IDkxLjAwMjEgNzYuMTM2N1Y3OC4xMzY3Wk04OS40Njg4IDc5LjY2NTVDODkuNDY4OCA3OC44MjI5IDkwLjE1MzUgNzguMTM2NyA5MS4wMDIxIDc4LjEzNjdWNzYuMTM2N0M4OS4wNTI0IDc2LjEzNjcgODcuNDY4OCA3Ny43MTQ5IDg3LjQ2ODggNzkuNjY1NUg4OS40Njg4Wk05MS4wMDIxIDgxLjE5NDJDOTAuMTUzNSA4MS4xOTQyIDg5LjQ2ODggODAuNTA4IDg5LjQ2ODggNzkuNjY1NUg4Ny40Njg4Qzg3LjQ2ODggODEuNjE2IDg5LjA1MjQgODMuMTk0MiA5MS4wMDIxIDgzLjE5NDJWODEuMTk0MlpNNzguMzM1OSA4Ni45OTk4Qzc4LjMzNTkgODUuMzQ4NSA3OS42NzQ2IDg0LjAwOTggODEuMzI2IDg0LjAwOThWODIuMDA5OEM3OC41NzAxIDgyLjAwOTggNzYuMzM1OSA4NC4yNDM5IDc2LjMzNTkgODYuOTk5OEg3OC4zMzU5Wk0xMDUuMzE3IDg1Ljk5OThINzcuMzM1OVY4Ny45OTk4SDEwNS4zMTdWODUuOTk5OFpNMTAxLjMyNyA4NC4wMDk4QzEwMi45NzggODQuMDA5OCAxMDQuMzE3IDg1LjM0ODUgMTA0LjMxNyA4Ni45OTk4SDEwNi4zMTdDMTA2LjMxNyA4NC4yNDM5IDEwNC4wODMgODIuMDA5OCAxMDEuMzI3IDgyLjAwOThWODQuMDA5OFpNODEuMzI2IDg0LjAwOThIMTAxLjMyN1Y4Mi4wMDk4SDgxLjMyNlY4NC4wMDk4WiIgZmlsbD0iIzM3N0ZGRCIvPgo8cmVjdCB4PSI3OS41IiB5PSI0MC41IiB3aWR0aD0iMjMiIGhlaWdodD0iMjkiIHJ4PSIzLjUiIGZpbGw9IiM4QkIzRkEiIHN0cm9rZT0iIzM3N0ZGRCIvPgo8cmVjdCB4PSI4MiIgeT0iNDQiIHdpZHRoPSIxNSIgaGVpZ2h0PSIxLjUiIHJ4PSIwLjc1IiBmaWxsPSIjMUYxRjFGIi8+CjxyZWN0IHg9IjgyIiB5PSI0OS4xMjUiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxLjUiIHJ4PSIwLjc1IiBmaWxsPSJ3aGl0ZSIvPgo8cmVjdCB4PSI4MiIgeT0iNTQuMjUiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxLjUiIHJ4PSIwLjc1IiBmaWxsPSJ3aGl0ZSIvPgo8cmVjdCB4PSI4MiIgeT0iNTkuMzc1IiB3aWR0aD0iMTgiIGhlaWdodD0iMS41IiByeD0iMC43NSIgZmlsbD0id2hpdGUiLz4KPHJlY3QgeD0iODIiIHk9IjY0LjUiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxLjUiIHJ4PSIwLjc1IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTEwMy40NTggOTEuNzc2OEMxMDcuNjc0IDkxLjc3NjggMTExLjU5MiA5MC41MDU4IDExNC44NDcgODguMzI3MUwxMjguMTY5IDEwMS4wMDFMMTMzIDk1LjQxNDJMMTIwLjE0NSA4My4xODQ2QzEyMi41MTkgNzkuODU0OSAxMjMuOTE1IDc1Ljc4NDEgMTIzLjkxNSA3MS4zODg0QzEyMy45MTUgNjAuMTI4MiAxMTQuNzU2IDUxIDEwMy40NTggNTFDOTIuMTU5MSA1MSA4MyA2MC4xMjgyIDgzIDcxLjM4ODRDODMgODIuNjQ4NiA5Mi4xNTkxIDkxLjc3NjggMTAzLjQ1OCA5MS43NzY4Wk0xMjAuOTA1IDcxLjM4OEMxMjAuOTA1IDgwLjkyMSAxMTMuMTUxIDg4LjY0OTEgMTAzLjU4NSA4OC42NDkxQzk0LjAxOTkgODguNjQ5MSA4Ni4yNjU2IDgwLjkyMSA4Ni4yNjU2IDcxLjM4OEM4Ni4yNjU2IDYxLjg1NSA5NC4wMTk5IDU0LjEyNyAxMDMuNTg1IDU0LjEyN0MxMTMuMTUxIDU0LjEyNyAxMjAuOTA1IDYxLjg1NSAxMjAuOTA1IDcxLjM4OFoiIGZpbGw9IiMxNDY3RjgiLz4KPGcgZmlsdGVyPSJ1cmwoI2ZpbHRlcjBfYl8xNjc2N183MTE5MikiPgo8cGF0aCBkPSJNMTAzLjQzNiA4OC44MjI3QzExMy4yMTYgODguODIyNyAxMjEuMTQ1IDgwLjk2OTYgMTIxLjE0NSA3MS4yODI0QzEyMS4xNDUgNjEuNTk1MiAxMTMuMjE2IDUzLjc0MjIgMTAzLjQzNiA1My43NDIyQzkzLjY1NTEgNTMuNzQyMiA4NS43MjY2IDYxLjU5NTIgODUuNzI2NiA3MS4yODI0Qzg1LjcyNjYgODAuOTY5NiA5My42NTUxIDg4LjgyMjcgMTAzLjQzNiA4OC44MjI3WiIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4zIi8+CjwvZz4KPHBhdGggZD0iTTEyNy44NCAxMDAuNzg5TDEzMi42MzYgOTUuMjI2NUwxMzMuMzU4IDk1LjkxNThDMTM0LjA1OSA5Ni41ODQ2IDEzNC40NzkgOTcuNTE5IDEzNC41MjUgOTguNTEzM0MxMzQuNTcxIDk5LjUwNzcgMTM0LjI0IDEwMC40ODEgMTMzLjYwNCAxMDEuMjE4QzEzMi45NjggMTAxLjk1NSAxMzIuMDggMTAyLjM5NyAxMzEuMTM1IDEwMi40NDVDMTMwLjE5IDEwMi40OTQgMTI5LjI2NSAxMDIuMTQ1IDEyOC41NjQgMTAxLjQ3NkwxMjcuODQyIDEwMC43ODdMMTI3Ljg0IDEwMC43ODlaIiBmaWxsPSIjODRBQ0YzIi8+CjxkZWZzPgo8ZmlsdGVyIGlkPSJmaWx0ZXIwX2JfMTY3NjdfNzExOTIiIHg9IjgyLjcyNjYiIHk9IjUwLjc0MjIiIHdpZHRoPSI0MS40MTgiIGhlaWdodD0iNDEuMDgyIiBmaWx0ZXJVbml0cz0idXNlclNwYWNlT25Vc2UiIGNvbG9yLWludGVycG9sYXRpb24tZmlsdGVycz0ic1JHQiI+CjxmZUZsb29kIGZsb29kLW9wYWNpdHk9IjAiIHJlc3VsdD0iQmFja2dyb3VuZEltYWdlRml4Ii8+CjxmZUdhdXNzaWFuQmx1ciBpbj0iQmFja2dyb3VuZEltYWdlRml4IiBzdGREZXZpYXRpb249IjEuNSIvPgo8ZmVDb21wb3NpdGUgaW4yPSJTb3VyY2VBbHBoYSIgb3BlcmF0b3I9ImluIiByZXN1bHQ9ImVmZmVjdDFfYmFja2dyb3VuZEJsdXJfMTY3NjdfNzExOTIiLz4KPGZlQmxlbmQgbW9kZT0ibm9ybWFsIiBpbj0iU291cmNlR3JhcGhpYyIgaW4yPSJlZmZlY3QxX2JhY2tncm91bmRCbHVyXzE2NzY3XzcxMTkyIiByZXN1bHQ9InNoYXBlIi8+CjwvZmlsdGVyPgo8L2RlZnM+Cjwvc3ZnPgo="
                        : "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgyIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDE4MiAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjkxIiBjeT0iNjAiIHI9IjYwIiBmaWxsPSIjRURGM0ZCIi8+CjxyZWN0IHg9IjM5IiB5PSI4OCIgd2lkdGg9IjEwNCIgaGVpZ2h0PSIzIiByeD0iMS41IiBmaWxsPSIjODRBQ0YzIi8+CjxtYXNrIGlkPSJwYXRoLTMtaW5zaWRlLTFfMTMzNTFfMTAzOTY3IiBmaWxsPSJ3aGl0ZSI+CjxyZWN0IHg9IjUzIiB5PSIzMyIgd2lkdGg9Ijc2IiBoZWlnaHQ9IjQ0IiByeD0iMiIvPgo8L21hc2s+CjxyZWN0IHg9IjUzIiB5PSIzMyIgd2lkdGg9Ijc2IiBoZWlnaHQ9IjQ0IiByeD0iMiIgZmlsbD0iI0VERjNGQiIgc3Ryb2tlPSIjMzc3RkZEIiBzdHJva2Utd2lkdGg9IjYiIG1hc2s9InVybCgjcGF0aC0zLWluc2lkZS0xXzEzMzUxXzEwMzk2NykiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik05MS4wMDIxIDgyLjE5NDJDOTIuNDAxMiA4Mi4xOTQyIDkzLjUzNTQgODEuMDYyIDkzLjUzNTQgNzkuNjY1NUM5My41MzU0IDc4LjI2ODkgOTIuNDAxMiA3Ny4xMzY3IDkxLjAwMjEgNzcuMTM2N0M4OS42MDMgNzcuMTM2NyA4OC40Njg4IDc4LjI2ODkgODguNDY4OCA3OS42NjU1Qzg4LjQ2ODggODEuMDYyIDg5LjYwMyA4Mi4xOTQyIDkxLjAwMjEgODIuMTk0MlpNODEuMzI2IDgzLjAwOThDNzkuMTIyMyA4My4wMDk4IDc3LjMzNTkgODQuNzk2MiA3Ny4zMzU5IDg2Ljk5OThIMTA1LjMxN0MxMDUuMzE3IDg0Ljc5NjIgMTAzLjUzMSA4My4wMDk4IDEwMS4zMjcgODMuMDA5OEg4MS4zMjZaIiBmaWxsPSIjRURGM0ZCIi8+CjxwYXRoIGQ9Ik03Ny4zMzU5IDg2Ljk5OThINzYuMzM1OVY4Ny45OTk4SDc3LjMzNTlWODYuOTk5OFpNMTA1LjMxNyA4Ni45OTk4Vjg3Ljk5OThIMTA2LjMxN1Y4Ni45OTk4SDEwNS4zMTdaTTkyLjUzNTQgNzkuNjY1NUM5Mi41MzU0IDgwLjUwOCA5MS44NTA2IDgxLjE5NDIgOTEuMDAyMSA4MS4xOTQyVjgzLjE5NDJDOTIuOTUxOCA4My4xOTQyIDk0LjUzNTQgODEuNjE2IDk0LjUzNTQgNzkuNjY1NUg5Mi41MzU0Wk05MS4wMDIxIDc4LjEzNjdDOTEuODUwNiA3OC4xMzY3IDkyLjUzNTQgNzguODIyOSA5Mi41MzU0IDc5LjY2NTVIOTQuNTM1NEM5NC41MzU0IDc3LjcxNDkgOTIuOTUxOCA3Ni4xMzY3IDkxLjAwMjEgNzYuMTM2N1Y3OC4xMzY3Wk04OS40Njg4IDc5LjY2NTVDODkuNDY4OCA3OC44MjI5IDkwLjE1MzUgNzguMTM2NyA5MS4wMDIxIDc4LjEzNjdWNzYuMTM2N0M4OS4wNTI0IDc2LjEzNjcgODcuNDY4OCA3Ny43MTQ5IDg3LjQ2ODggNzkuNjY1NUg4OS40Njg4Wk05MS4wMDIxIDgxLjE5NDJDOTAuMTUzNSA4MS4xOTQyIDg5LjQ2ODggODAuNTA4IDg5LjQ2ODggNzkuNjY1NUg4Ny40Njg4Qzg3LjQ2ODggODEuNjE2IDg5LjA1MjQgODMuMTk0MiA5MS4wMDIxIDgzLjE5NDJWODEuMTk0MlpNNzguMzM1OSA4Ni45OTk4Qzc4LjMzNTkgODUuMzQ4NSA3OS42NzQ2IDg0LjAwOTggODEuMzI2IDg0LjAwOThWODIuMDA5OEM3OC41NzAxIDgyLjAwOTggNzYuMzM1OSA4NC4yNDM5IDc2LjMzNTkgODYuOTk5OEg3OC4zMzU5Wk0xMDUuMzE3IDg1Ljk5OThINzcuMzM1OVY4Ny45OTk4SDEwNS4zMTdWODUuOTk5OFpNMTAxLjMyNyA4NC4wMDk4QzEwMi45NzggODQuMDA5OCAxMDQuMzE3IDg1LjM0ODUgMTA0LjMxNyA4Ni45OTk4SDEwNi4zMTdDMTA2LjMxNyA4NC4yNDM5IDEwNC4wODMgODIuMDA5OCAxMDEuMzI3IDgyLjAwOThWODQuMDA5OFpNODEuMzI2IDg0LjAwOThIMTAxLjMyN1Y4Mi4wMDk4SDgxLjMyNlY4NC4wMDk4WiIgZmlsbD0iIzM3N0ZGRCIvPgo8cmVjdCB4PSI3OS43NSIgeT0iNDAuNzUiIHdpZHRoPSIyMi41IiBoZWlnaHQ9IjI4LjUiIHJ4PSIyLjI1IiBmaWxsPSIjOEJCM0ZBIiBzdHJva2U9IiMzNzdGRkQiIHN0cm9rZS13aWR0aD0iMS41Ii8+CjxyZWN0IHg9IjgxLjY2OCIgeT0iNDQuNDEyMSIgd2lkdGg9IjE1IiBoZWlnaHQ9IjEiIHJ4PSIwLjUiIGZpbGw9IiMwNDI4NjYiLz4KPHJlY3QgeD0iODEuNjY4IiB5PSI0OS42Nzc3IiB3aWR0aD0iMTguNjY2NyIgaGVpZ2h0PSIxIiByeD0iMC41IiBmaWxsPSJ3aGl0ZSIvPgo8cmVjdCB4PSI4MS42NjgiIHk9IjU0Ljk0MTQiIHdpZHRoPSIxOC42NjY3IiBoZWlnaHQ9IjEiIHJ4PSIwLjUiIGZpbGw9IndoaXRlIi8+CjxyZWN0IHg9IjgxLjY2OCIgeT0iNjAuMjA3IiB3aWR0aD0iMTguNjY2NyIgaGVpZ2h0PSIxIiByeD0iMC41IiBmaWxsPSJ3aGl0ZSIvPgo8cmVjdCB4PSI4MS42NjgiIHk9IjY1LjQ3MDciIHdpZHRoPSIxOC42NjY3IiBoZWlnaHQ9IjEiIHJ4PSIwLjUiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNOTkuMzY5NiA4Ni42MjE4QzEwMi45NDkgODYuNjIxOCAxMDYuMjc2IDg1LjU0MjUgMTA5LjA0MSA4My42OTI1TDEyMC4zNTIgOTQuNDUzM0wxMjQuNDU0IDg5LjcxMDFMMTEzLjUzOSA3OS4zMjYxQzExNS41NTQgNzYuNDk5IDExNi43MzkgNzMuMDQyOSAxMTYuNzM5IDY5LjMxMDlDMTE2LjczOSA1OS43NTA0IDEwOC45NjMgNTIgOTkuMzY5NiA1MkM4OS43NzY2IDUyIDgyIDU5Ljc1MDQgODIgNjkuMzEwOUM4MiA3OC44NzE1IDg5Ljc3NjYgODYuNjIxOCA5OS4zNjk2IDg2LjYyMThaTTExNC4xODQgNjkuMzA5OUMxMTQuMTg0IDc3LjQwNCAxMDcuNiA4My45NjU1IDk5LjQ3ODcgODMuOTY1NUM5MS4zNTcyIDgzLjk2NTUgODQuNzczNCA3Ny40MDQgODQuNzczNCA2OS4zMDk5Qzg0Ljc3MzQgNjEuMjE1OCA5MS4zNTcyIDU0LjY1NDMgOTkuNDc4NyA1NC42NTQzQzEwNy42IDU0LjY1NDMgMTE0LjE4NCA2MS4yMTU4IDExNC4xODQgNjkuMzA5OVoiIGZpbGw9IiMxNDY3RjgiLz4KPGcgZmlsdGVyPSJ1cmwoI2ZpbHRlcjBfYl8xMzM1MV8xMDM5NjcpIj4KPHBhdGggZD0iTTk5LjM1MjMgODQuMTEzNEMxMDcuNjU2IDg0LjExMzQgMTE0LjM4OCA3Ny40NDU3IDExNC4zODggNjkuMjIwOEMxMTQuMzg4IDYwLjk5NTggMTA3LjY1NiA1NC4zMjgxIDk5LjM1MjMgNTQuMzI4MUM5MS4wNDgyIDU0LjMyODEgODQuMzE2NCA2MC45OTU4IDg0LjMxNjQgNjkuMjIwOEM4NC4zMTY0IDc3LjQ0NTcgOTEuMDQ4MiA4NC4xMTM0IDk5LjM1MjMgODQuMTEzNFoiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMyIvPgo8L2c+CjxwYXRoIGQ9Ik0xMjAuMDcgOTQuMjczNEwxMjQuMTQyIDg5LjU1MDVMMTI0Ljc1NiA5MC4xMzU4QzEyNS4zNTEgOTAuNzAzNiAxMjUuNzA3IDkxLjQ5NyAxMjUuNzQ2IDkyLjM0MTJDMTI1Ljc4NSA5My4xODU1IDEyNS41MDQgOTQuMDExNSAxMjQuOTY0IDk0LjYzNzVDMTI0LjQyNSA5NS4yNjM2IDEyMy42NyA5NS42Mzg0IDEyMi44NjggOTUuNjc5NkMxMjIuMDY1IDk1LjcyMDcgMTIxLjI4IDk1LjQyNDggMTIwLjY4NSA5NC44NTY5TDEyMC4wNzIgOTQuMjcxNkwxMjAuMDcgOTQuMjczNFoiIGZpbGw9IiMwNDI4NjYiLz4KPGRlZnM+CjxmaWx0ZXIgaWQ9ImZpbHRlcjBfYl8xMzM1MV8xMDM5NjciIHg9IjgxLjMxNjQiIHk9IjUxLjMyODEiIHdpZHRoPSIzNi4wNzAzIiBoZWlnaHQ9IjM1Ljc4NTIiIGZpbHRlclVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgY29sb3ItaW50ZXJwb2xhdGlvbi1maWx0ZXJzPSJzUkdCIj4KPGZlRmxvb2QgZmxvb2Qtb3BhY2l0eT0iMCIgcmVzdWx0PSJCYWNrZ3JvdW5kSW1hZ2VGaXgiLz4KPGZlR2F1c3NpYW5CbHVyIGluPSJCYWNrZ3JvdW5kSW1hZ2VGaXgiIHN0ZERldmlhdGlvbj0iMS41Ii8+CjxmZUNvbXBvc2l0ZSBpbjI9IlNvdXJjZUFscGhhIiBvcGVyYXRvcj0iaW4iIHJlc3VsdD0iZWZmZWN0MV9iYWNrZ3JvdW5kQmx1cl8xMzM1MV8xMDM5NjciLz4KPGZlQmxlbmQgbW9kZT0ibm9ybWFsIiBpbj0iU291cmNlR3JhcGhpYyIgaW4yPSJlZmZlY3QxX2JhY2tncm91bmRCbHVyXzEzMzUxXzEwMzk2NyIgcmVzdWx0PSJzaGFwZSIvPgo8L2ZpbHRlcj4KPC9kZWZzPgo8L3N2Zz4K"
                    }
                  />
                  No available option
                </div>
              )}
              {!optionsToRender.length && loading && (
                <Loader visible={!optionsToRender.length && loading} />
              )}
            </div>
            {props.footer && <div className="MenuFooter">{props.footer}</div>}
            {props.autoComplete && (
              <div className="MenuFooter">
                <Button
                  label="Apply"
                  type="ghost"
                  disabled={!searchValue}
                  onClick={() => {
                    props.onSelect?.(searchValue, null);
                    (document.activeElement as HTMLElement)?.blur();
                  }}
                />
              </div>
            )}
          </>
        )}
      </ul>
    </div>
  );
});

export { Option };
export default Menu;

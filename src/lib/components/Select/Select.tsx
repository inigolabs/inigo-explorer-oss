import "./Select.scss";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  Children,
  isValidElement,
  cloneElement,
  useRef,
  useState,
  useCallback,
} from "react";
import classNames from "classnames";
import { IOptionProps, ISelectProps, ISelectRef } from "./Select.types";
import Icon, { IconClear, IconDown, IconUp } from "../Icon/Icon";

function Option(props: IOptionProps) {
  return (
    <li
      className={classNames("SelectOption", props.className)}
      hidden={props.hidden}
      onClick={(ev) => {
        ev.stopPropagation();
        props.onClick?.(props.value);
      }}
    >
      {props.children}
    </li>
  );
}

const Select = forwardRef<ISelectRef, ISelectProps>((props, ref) => {
  const [value, setValue] = useState<unknown>(props.defaultValue);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optionsStyle, setOptionsStyle] = useState<React.CSSProperties>({});

  const targetRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLUListElement>(null);

  const validate = useCallback(
    (value: unknown) => {
      let error: string | null = null;

      if (props.required && !value) {
        error = "Please fill the field";
      }

      return error;

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [props.required]
  );

  useImperativeHandle(ref, () => ({
    clear: () => {
      updateValue(undefined);
    },
    getValue: () => value,
    validate: () => {
      const validationResult = validate(value);

      setError(validationResult);

      return !validationResult;
    },
    setValue: (value: unknown) => {
      updateValue(value);
    },
    setError: (error: unknown) => {
      if (error) {
        error = `${error}`;
      } else {
        error = null;
      }

      setError(error as string);
    },
  }));

  function updateValue(value: unknown) {
    setValue(value);
    setError(null);
    props.onChange?.(value, setValue);
  }

  const options = Children.map(
    // @ts-ignore
    Children.toArray(props.children),
    (child: React.ReactElement<IOptionProps>) => {
      if (isValidElement(child)) {
        return cloneElement(child, {
          onClick: (value: any) => {
            updateValue(value);

            setIsActive(false);
            (document.activeElement as HTMLElement)?.blur();
          },
          active: child.props.value === value,
        });
      }
      return child;
    }
  );

  useEffect(() => {
    if (props.value !== undefined) {
      setValue(props.value);
    }
  }, [props.value]);

  const handleClearClick = () => {
    setIsActive(false);
    updateValue(undefined);
  };

  const onKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>) => {
    if (options.length) {
      if (ev.key === "ArrowUp") {
        const nextValue =
          options[
            options.findIndex((option) => option.props.value === value) + 1
          ]?.props.value;

        if (nextValue) {
          updateValue(nextValue);
        } else {
          updateValue(options[0].props.value);
        }
      }

      if (ev.key === "ArrowDown") {
        const prevValue =
          options[
            options.findIndex((option) => option.props.value === value) - 1
          ]?.props.value;

        if (prevValue) {
          updateValue(prevValue);
        } else {
          updateValue(options[options.length - 1].props.value);
        }
      }

      if (ev.key === "Enter") {
        setIsActive(false);
      }
    }
  };

  const handleOptionsStyle = () => {
    const { current: targetEl } = targetRef;
    const { current: optionsEl } = optionsRef;

    if (targetEl && optionsEl) {
      const optionsRect = optionsEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      let top = targetRect.bottom + 4;

      if (top + optionsRect.height > window.innerHeight) {
        top = targetRect.top - targetRect.height - optionsRect.height - 8;
      }

      if (props.position === "top") {
        top = targetRect.top - targetRect.height - optionsRect.height - 8;
      }

      setOptionsStyle({
        top,
        left: targetRect.left,
        width: targetRect.width,
      });
    }
  };

  useEffect(() => {
    if (isActive) {
      handleOptionsStyle();
    }
  }, [isActive]);

  return (
    <div
      onFocus={() => setIsActive(true)}
      onKeyDown={onKeyDown}
      className={classNames(
        "Select",
        {
          Active: isActive,
          Disabled: props.readOnly,
          Alternate: props.alternate,
          Compact: props.compact,
        },
        props.className
      )}
      data-scalar={true}
    >
      {props.label && <div className="FormLabel">{props.label}</div>}
      <div
        ref={targetRef}
        className={classNames("Input", { HasError: !!error })}
        tabIndex={props.readOnly ? -1 : 0}
        onBlur={() => setTimeout(() => setIsActive(false), 200)}
        style={props.style}
      >
        {value !== undefined && (
          <div className="Field">
            {props.prefix}
            {options.find((option) => option.props.value === value)?.props
              .children ?? ""}
          </div>
        )}
        {value === undefined && (
          <div className="Field Placeholder">{props.placeholder}</div>
        )}
        <div className="Suffix">
          {value !== undefined && props.clearButton && (
            <button className="SelectClear" onClick={() => handleClearClick()}>
              <Icon icon={<IconClear />}></Icon>
            </button>
          )}
          <div
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setIsActive(!isActive);
            }}
            onFocusCapture={(e) => {
              e.stopPropagation();
            }}
          >
            <Icon size={12} icon={isActive ? <IconUp /> : <IconDown />} />
          </div>
        </div>
      </div>
      {!!error && props.shouldRenderErrorMessages && (
        <div className="Error">{error}</div>
      )}
      <ul
        ref={optionsRef}
        className={classNames("Options", { top: props?.position })}
        style={optionsStyle}
      >
        {options}
      </ul>
    </div>
  );
});

Select.displayName = "Select";

export { Option };
export default Select;

import styles from "./Checkbox.module.css";
import {
  useState,
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
} from "react";
import classNames from "classnames";
import { CheckboxProps, CheckboxRef, CheckboxVariant } from "./Checkbox.types";
import Icon, { IconCheck, IconPartialCheck } from "../Icon/Icon";

const Checkbox = forwardRef<CheckboxRef, CheckboxProps>((props, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<boolean>(!!props.defaultValue);

  useEffect(() => {
    if (typeof props.value === "boolean") {
      setValue(props.value);

      if (inputRef.current) {
        inputRef.current.checked = props.value;
      }
    }
  }, [props.value]);

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => {
        return inputRef.current?.checked ?? false;
      },
      setValue: (value) => {
        const { current: inputElement } = inputRef;

        if (inputElement) {
          inputElement.checked = value;
        }
      },
      validate: () => {
        return true;
      },
      setError: () => {
        return;
      },
      clear: () => {
        const { current: inputElement } = inputRef;

        if (inputElement) {
          inputElement.checked = !!props.defaultValue;
        }
      },
    }),
    [props.defaultValue, inputRef]
  );

  return (
    <div
      className={classNames(
        styles.wrapper,
        { [styles.checked]: value },
        styles[props.variant ?? CheckboxVariant.Default],
        props.disabled && styles.disabled,
        props.readOnly && styles.readOnly,
        props.partial && styles.partial,
        props.className
      )}
      data-scalar={true}
      style={props.style}
    >
      <div className={styles.checkbox}>
        <input
          ref={inputRef}
          type="checkbox"
          defaultChecked={!!props.defaultValue}
          onChange={(e) => {
            setValue(e.target.checked);
            props.onChange?.(e.target.checked);
          }}
          disabled={props.disabled || props.readOnly}
        />
        {props.variant === CheckboxVariant.Switch ? (
          <div className={styles.switch}>
            <div className={styles.handle} />
          </div>
        ) : props.partial ? (
          <div className={styles.overlay}>
            <Icon size={16} icon={<IconPartialCheck />} />
          </div>
        ) : (
          <div className={styles.overlay}>
            <Icon size={16} icon={<IconCheck />} />
          </div>
        )}
        {props.placeholder && (
          <div className={styles.placeholder}>{props.placeholder}</div>
        )}
      </div>
      {props.children}
    </div>
  );
});

Checkbox.displayName = "Checkbox";

export default Checkbox;

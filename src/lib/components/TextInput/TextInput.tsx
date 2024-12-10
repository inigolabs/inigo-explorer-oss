import styles from "./TextInput.module.css";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import classNames from "classnames";

import { TextInputProps, TextInputRef } from "./TextInput.types";
import Icon, { ArrowDown, ArrowUp, Close, CrossedEye, Eye } from "../Icon/Icon";

const TextInput = forwardRef<TextInputRef, TextInputProps>((props, ref) => {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [type, setType] = useState<HTMLInputElement["type"]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    setError(props.error);
  }, [props.error]);

  useEffect(() => {
    setType(props.type);
  }, [props.type]);

  const validate = useCallback(
    (value: string) => {
      let error: string | undefined;

      if (props.required && !value?.trim()) {
        error = "Please fill the field";
      } else if (
        value &&
        props.pattern &&
        !new RegExp(props.pattern).test(value)
      ) {
        error = "This field is invalid";
      } else if (value && props.minLength) {
        if (value.length < props.minLength) {
          error = `This field must be at least ${props.minLength} characters`;
        } else {
          error = undefined;
        }
      } else if (value && props.maxLength) {
        if (value.length > props.maxLength) {
          error = `This field must be at most ${props.maxLength} characters`;
        } else {
          error = undefined;
        }
      } else {
        error = undefined;
      }

      return error;

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      props.required,
      props.minimum,
      props.maximum,
      props.pattern,
      props.minLength,
      props.maxLength,
    ]
  );

  useImperativeHandle(
    ref,
    () => ({
      setValue: (value) => {
        const { current: inputElement } = inputRef;

        if (inputElement) {
          inputElement.value = value;
        }
      },
      getValue: () => {
        const { current: inputElement } = inputRef;

        return inputElement?.value ?? "";
      },
      validate: () => {
        const validationResult = validate(inputRef.current?.value ?? "");

        setError(validationResult);

        return !validationResult;
      },
      setError: (error) => {
        setError(error);
      },
      clear: () => {
        const { current: inputElement } = inputRef;

        if (inputElement) {
          inputElement.value = "";
        }
      },
      focus: () => {
        const { current: inputElement } = inputRef;

        if (inputElement) {
          inputElement.focus();
        }
      },

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }),
    [validate, inputRef]
  );

  const onContainerClick = useCallback(() => {
    const { current: inputElement } = inputRef;

    if (inputElement && !props.disabled && !props.readOnly) {
      inputElement.focus();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputRef, props.disabled, props.readOnly]);

  const onChange = useCallback(
    (value: string) => {
      const validationResult = validate(value);

      setError(validationResult);

      if (props.onValidate) {
        props.onValidate(!validationResult);
      }

      if (props.onChange) {
        props.onChange(value);
      }

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [props.onChange, props.onValidate, validate]
  );

  const onBlur = useCallback(() => {
    const { current: inputElement } = inputRef;

    if (inputElement) {
      const validationResult = validate(inputElement.value);

      setError(validationResult);

      if (props.onValidate) {
        props.onValidate(!error);
      }

      if (props.onBlur) {
        props.onBlur(inputElement.value);
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onBlur, props.onValidate, validate, inputRef]);

  return (
    <div
      className={classNames(
        styles.container,
        {
          [styles.disabled]: props.disabled,
          [styles.readOnly]: props.readOnly,
          [styles.hasError]: !!error,
          [styles.required]: props.required,
          [styles.multiline]: props.multiline,
        },
        props.className
      )}
      onClick={onContainerClick}
      tabIndex={-1}
      data-scalar={true}
    >
      {!!props.label && <div className={styles.label}>{props.label}</div>}
      <div className={styles.field} style={props.style}>
        {props.multiline ? (
          <textarea
            ref={inputRef as React.Ref<HTMLTextAreaElement>}
            // name={props.name}
            className={styles.input}
            placeholder={props.placeholder}
            disabled={props.disabled}
            readOnly={props.readOnly}
            defaultValue={props.defaultValue}
            rows={12}
            onKeyDown={(e) => e.key === "Enter" && e.stopPropagation()}
            onChange={(e) => onChange(e.currentTarget.value)}
            onBlur={onBlur}
          />
        ) : (
          <>
            {!!props.prefix && (
              <div className={styles.prefix}>{props.prefix}</div>
            )}
            <input
              ref={inputRef as React.Ref<HTMLInputElement>}
              // name={props.name}
              className={styles.input}
              type={type}
              placeholder={props.placeholder}
              disabled={props.disabled}
              readOnly={props.readOnly}
              defaultValue={props.defaultValue}
              onChange={(e) => onChange(e.currentTarget.value)}
              onBlur={onBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  props.onEnterPress?.();
                }
              }}
            />
            {!!props.suffix && (
              <div className={styles.suffix}>{props.suffix}</div>
            )}
          </>
        )}
        {props.type === "number" && (
          <>
            <button
              tabIndex={-1}
              className={styles.up}
              onClick={() => {
                const newValue = `${
                  Number(inputRef.current?.value ?? "0") + 1
                }`;

                inputRef.current!.value = newValue;

                onChange(newValue);
              }}
            >
              <Icon icon={<ArrowUp />} size={12} />
            </button>
            <button
              tabIndex={-1}
              className={styles.down}
              onClick={() => {
                const newValue = `${
                  Number(inputRef.current?.value ?? "0") - 1
                }`;

                inputRef.current!.value = newValue;

                onChange(newValue);
              }}
            >
              <Icon icon={<ArrowDown />} size={12} />
            </button>
          </>
        )}
        {props.clearBtn && !props.readOnly && (
          <div
            className={classNames(styles.suffix, styles.clearBtn)}
            onClick={(ev) => {
              ev.stopPropagation();
              if (inputRef.current) {
                inputRef.current.value = "";
                onChange("");
              }
            }}
          >
            <Icon size={12} icon={<Close />} />
          </div>
        )}
        {props.type === "password" && !props.readOnly && (
          <div
            className={classNames(styles.suffix, styles.passwordToggle)}
            onClick={(ev) => {
              ev.stopPropagation();
              if (type === "password") {
                setType("text");
              } else {
                setType("password");
              }
            }}
          >
            <Icon
              size={16}
              icon={type === "password" ? <Eye /> : <CrossedEye />}
            />
          </div>
        )}
      </div>
      {!!error && props.shouldRenderErrorMessages !== false && (
        <div className={styles.error}>{error}</div>
      )}
    </div>
  );
});

TextInput.displayName = "TextInput";

export * from "./TextInput.types";
export default TextInput;

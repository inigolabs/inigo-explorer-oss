import styles from "./AutoComplete.module.css";
import {
  forwardRef,
  useState,
  useMemo,
  useRef,
  useCallback,
  useImperativeHandle,
} from "react";
import { FormControl, FormControlRef } from "../Form/Form.types";
import Menu from "../Menu/DropdownMenu";
import TextInput, { TextInputRef } from "../TextInput/TextInput";

export interface IAutoCompleteRef extends FormControlRef<string> {}

export interface IAutoCompleteProps extends FormControl<string> {
  className?: string;
  label?: React.ReactNode;
  placeholder?: string;
  options: string[];
  renderValue?: (value: string) => string;
  renderOption?: (option: string) => React.ReactNode;
}

const AutoComplete = forwardRef<IAutoCompleteRef, IAutoCompleteProps>(
  (props, ref) => {
    const inputRef = useRef<TextInputRef>(null);
    const [value, setValue] = useState(props.defaultValue ?? "");

    const suggestions = useMemo(() => {
      return props.options.filter((option) => {
        if (!value) {
          return true;
        }

        return (
          option
            .toString()
            .toLowerCase()
            .includes(value.toString().toLowerCase()) && option !== value
        );
      });
    }, [props.options, props.renderOption, value]);

    const onOptionClick = useCallback(
      (option: string) => {
        setValue(option);

        if (inputRef.current) {
          inputRef.current.setValue(
            props.renderValue ? props.renderValue(option) : option
          );
        }

        if (props.onChange) {
          props.onChange(option);
        }
      },
      [props.renderValue, props.onChange]
    );

    useImperativeHandle(ref, () => ({
      clear: () => {
        setValue("");
      },
      getValue: () => value,
      validate: () => {
        return true;
      },
      setValue: (value: unknown) => {
        setValue("");

        if (inputRef.current) {
          inputRef.current.setValue(value as string);
        }
      },
      setError: () => {},
    }));

    return (
      <Menu
        target={
          <TextInput
            ref={inputRef}
            label={props.label}
            placeholder={props.placeholder}
            onChange={(value) => {
              setValue(value);

              if (props.onChange) {
                props.onChange(value);
              }
            }}
            defaultValue={props.defaultValue}
          />
        }
        disableDropdown={!suggestions.length}
      >
        <div className={styles.options}>
          {suggestions.map((option) => (
            <div
              key={option}
              className={styles.option}
              onClick={() => onOptionClick(option)}
            >
              {props.renderOption ? props.renderOption(option) : option}
            </div>
          ))}
        </div>
      </Menu>
    );
  }
);

export default AutoComplete;

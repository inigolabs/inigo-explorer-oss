import { FormControl, FormControlRef } from "../Form/Form.types";

export interface IOptionProps {
  value: unknown;
  className?: string;
  children?: number | string | JSX.Element | JSX.Element[];
  active?: boolean;
  hidden?: boolean;
  onClick?: (value: unknown) => void;
  render?: (value: unknown) => React.ReactNode;
}

export interface ISelectRef extends FormControlRef<unknown> {}

export interface ISelectProps extends FormControl<unknown> {
  className?: string;
  clearButton?: boolean;
  label?: React.ReactNode;
  value?: unknown;
  alternate?: boolean;
  prefix?: React.ReactNode;
  placeholder?: string;
  readOnly?: boolean;
  renderOption?: (value: unknown) => React.ReactNode;
  children?:
    | React.ReactElement<IOptionProps>
    | React.ReactElement<IOptionProps>[];
  onChange?: (value: unknown, updateValue: (value: unknown) => void) => void;
  position?: string;
  compact?: boolean;
}

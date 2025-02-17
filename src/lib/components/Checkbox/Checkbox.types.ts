import { FormControl, FormControlRef } from "../Form/Form";

export interface CheckboxRef extends FormControlRef<boolean> {}

export enum CheckboxVariant {
  Default = "default",
  Switch = "switch",
}

export interface CheckboxProps extends FormControl<boolean> {
  className?: string;
  children?: React.ReactNode;
  placeholder?: React.ReactNode;
  variant?: CheckboxVariant;
  onText?: string;
  offText?: string;
  disabled?: boolean;
  readOnly?: boolean;
  partial?: boolean;
}

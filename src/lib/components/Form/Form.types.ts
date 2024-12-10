export interface FormControlRef<T = unknown> {
  name?: string;
  setValue: (value: T) => void;
  getValue: () => T;
  validate: () => boolean;
  setError: (error: T) => void;
  clear: () => void;
  focus?: () => void;
}

export interface FormControl<T = unknown> {
  name?: string;
  style?: React.CSSProperties;
  value?: T;
  ref?: React.RefObject<unknown>;
  defaultValue?: T;
  onChange?: (value: T, ...rest: any[]) => void;
  onValidate?: (isValid: boolean) => void;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  required?: boolean;
  pattern?: string;
  shouldRenderErrorMessages?: boolean;
}

export type FormChild = React.ReactNode;

export type FormValue = Record<string, unknown>;

export interface FormRef extends FormControlRef<FormValue> {}

export interface FormProps extends FormControl<FormValue> {
  title?: React.ReactNode;
  children: FormChild | FormChild[];
  className?: string;
  onSubmit?: (value: FormValue, e: React.KeyboardEvent<HTMLDivElement>) => void;
  containerStyle?: React.CSSProperties;
  shouldRenderErrorMessages?: boolean;
}

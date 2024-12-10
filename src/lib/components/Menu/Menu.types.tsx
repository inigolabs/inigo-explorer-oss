export interface IOptionProps {
  className?: string;
  disabled?: boolean;
  active?: boolean;
  value?: unknown;
  readOnly?: boolean;
  children: string | JSX.Element | JSX.Element[];
  onClick?: (value: unknown) => void;
  render?: (props: IOptionProps) => React.ReactNode;
  onChange?: (value: unknown) => void;
  multiSelect?: boolean;
  data?: string[];
  type?: string;
  searchValue?: string;
  isSelected?: boolean;
}

export interface IMenuRef {
  focus: () => void;
  focusSearch: () => void;
}

export interface IMenuProps {
  className?: string;
  value?: unknown;
  multiSelect?: boolean;
  search?: boolean;
  onSearch?: (value: string) => void;
  ignoreSelectedSort?: boolean;
  autoComplete?: boolean;
  minWidth?: number;
  placeholder?: string;
  fetchOptions?: (value: string) => Promise<React.ReactNode>;
  disabled?: boolean;
  onClear?: () => void;
  onSelect?: (value: unknown, options: IOptionProps | null) => void;
  onBlur?: (value: unknown) => void;
  onActiveChange?: (active: boolean) => void;
  target: React.ReactNode | ((active?: boolean) => React.ReactNode);
  trigger?: "hover" | "focus";
  placement?: "left" | "right";
  position?: "top" | "bottom" | "left" | "right";
  data?: string[];
  children?: React.ReactNode;
  footer?: React.ReactNode;
  disableDropdown?: boolean;
  theme?: "light" | "dark";
}

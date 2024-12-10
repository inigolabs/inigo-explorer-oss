import { ReactNode } from 'react';

import { FormControl, FormControlRef } from '../Form/Form';

export interface TextInputRef extends FormControlRef<string> {}

export interface TextInputProps extends FormControl<string> {
  className?: string;
  label?: React.ReactNode;
  error?: string;
  type?: HTMLInputElement['type'];
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  multiline?: boolean;
  clearBtn?: boolean;
  onBlur?: FormControl<string>['onChange'];
  onEnterPress?: () => void;
}

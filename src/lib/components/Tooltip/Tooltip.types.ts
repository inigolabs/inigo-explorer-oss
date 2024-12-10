import { ReactNode } from 'react';

export interface ITooltipProps extends React.HTMLProps<HTMLDivElement> {
  text?: string;
  hideTimeout?: number;
  timeout?: number;
  parentClassName?: string;
  targetClassName?: string;
  children: React.ReactNode;
  position?: TooltipPosition;
  truncated?: boolean;
  renderContent?: (props: any) => ReactNode;
  style?: React.CSSProperties;
  targetStyle?: React.CSSProperties;
  popupStyle?: React.CSSProperties;
  hideArrow?: boolean;
  disabled?: boolean;
}

export enum TooltipPosition {
  Left = 'left',
  Right = 'right',
  Top = 'top',
  Bottom = 'bottom',
}

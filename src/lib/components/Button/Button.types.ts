export interface IButtonProps {
  className?: string;
  label?: string;
  style?: React.CSSProperties;
  icon?: JSX.Element | string;
  iconSize?: number;
  loading?: boolean;
  iconPosition?: 'right' | 'left';
  disabled?: boolean;
  type?: 'primary' | 'border' | 'link' | 'secondary' | 'ghost' | 'text';
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

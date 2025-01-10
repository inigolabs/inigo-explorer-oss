export interface DrawerProps {
  title?: string;
  description?: string;
  visible?: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

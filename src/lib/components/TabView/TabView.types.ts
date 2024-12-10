export interface TabProps {
  label: string;
  path: string;
  children?: React.ReactNode;
  disabled?: boolean;
}
export interface TabViewProps {
  actionsAlign?: 'left' | 'right';
  actions?: React.ReactNode;
  viewStyle?: React.CSSProperties;
  disableQueryParams?: boolean;
  queryParamName?: string;
  disableDivider?: boolean;
  disableBorder?: boolean;
  disabled?: boolean;
  onSelect?: (tab: TabProps) => void;
  children?: React.ReactElement<TabProps> | React.ReactElement<TabProps>[] | null | false;
}

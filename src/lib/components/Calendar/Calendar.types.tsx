export interface ICalendarProps {
  selected?: string | string[];
  hovered?: string;
  activeIndex?: 0 | 1;
  min?: string;
  max?: string;
  range?: boolean;
  onChange?: (date: string | [string, string]) => void;
  onHover?: (date: string) => void;
  onActiveIndexChange?: (index: 0 | 1) => void;
}

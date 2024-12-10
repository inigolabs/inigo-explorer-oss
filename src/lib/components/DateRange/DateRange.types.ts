export interface IDateRangeProps {
  selected?: [string, string];
  defaultSelected?: [string, string];
  min?: string;
  max?: string;
  onChange?: (value: [string, string]) => void;
}

export interface ITimeInputProps { 
  value?: [number, number];
  onChange?: (value: [number, number]) => void;
}
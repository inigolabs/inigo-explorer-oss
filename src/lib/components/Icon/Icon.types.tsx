export interface IIconProps {
  className?: string;
  icon: React.ReactNode | string;
  viewBoxSize?: number;
  size?: number | Size; // for view box
  containerSize?: number | Size; // for icon div itself to scale icon
}

export type Size = {
  width: number;
  height: number;
};

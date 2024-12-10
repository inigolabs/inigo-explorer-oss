// import './Button.scss';
import NewButton, { ButtonVariant } from "../Buttons/Button";
import { IButtonProps } from "./Button.types";
import Icon from "../Icon/Icon";
import { useMemo } from "react";

function Button(props: IButtonProps) {
  const { type, className, disabled, label, icon, onClick, iconPosition } =
    props;

  const hasIconOnly = useMemo(() => !label && !!icon, [label, icon]);

  const variant: ButtonVariant = useMemo(() => {
    if (type === "primary") {
      return ButtonVariant.Primary;
    } else if (type === "border") {
      return ButtonVariant.Outline;
    } else if (type === "link") {
      return ButtonVariant.Link;
    } else if (type === "text") {
      return ButtonVariant.Text;
    } else if (type === "secondary") {
      return ButtonVariant.Secondary;
    } else if (type === "ghost") {
      return ButtonVariant.Secondary;
    } else {
      return ButtonVariant.Primary;
    }
  }, [type]);

  return (
    <NewButton
      className={className}
      icon={hasIconOnly}
      onClick={onClick}
      variant={variant}
      disabled={disabled}
    >
      {!!icon && (iconPosition === "left" || !iconPosition) && (
        <Icon size={props.iconSize ?? 16} icon={icon} />
      )}
      {label}
      {!!icon && iconPosition === "right" && (
        <Icon size={props.iconSize ?? 16} icon={icon} />
      )}
    </NewButton>
  );

  // if (props.loading) {
  //   return (
  //     <div
  //       tabIndex={0}
  //       className={classNames(
  //         'Button',
  //         className,
  //         type ?? 'primary',
  //         disabled && 'disabled',
  //         hasIconOnly && 'IconOnly',
  //         'Loading',
  //       )}
  //       style={props.style}
  //     >
  //       <div className="ButtonIcon">
  //         <div className="ButtonLoader" />
  //       </div>
  //       {!hasIconOnly && <div className="ButtonLabel">Loading...</div>}
  //     </div>
  //   );
  // }

  // return (
  //   <div
  //     tabIndex={props.disabled ? -1 : 0}
  //     className={classNames('Button', className, type ?? 'primary', disabled && 'disabled', hasIconOnly && 'IconOnly')}
  //     style={props.style}
  //     onClick={(e) => {
  //       if (props.disabled) return;

  //       onClick?.(e);
  //     }}
  //   >
  //     {!!icon && (!iconPosition || iconPosition === 'left') && (
  //       <div className="ButtonIcon">
  //         <Icon size={16} icon={icon} />
  //       </div>
  //     )}
  //     {!!props.label && <div className="ButtonLabel">{label}</div>}
  //     {!!icon && iconPosition === 'right' && (
  //       <div className={classNames('ButtonIcon', { Right: true })}>
  //         <Icon size={props.iconSize ?? 16} icon={icon} />
  //       </div>
  //     )}
  //   </div>
  // );
}

export default Button;

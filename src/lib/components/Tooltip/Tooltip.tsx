import "./Tooltip.scss";
import { useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import { ITooltipProps } from "./Tooltip.types";
import { createPortal } from "react-dom";

function Tooltip(props: ITooltipProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  let timeout = useRef<number>(0);
  let hideTimeout = useRef<number>(0);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [arrowPositionTop, setArrowPositionTop] = useState<number>(0);
  const [arrowPositionLeft, setArrowPositionLeft] = useState<number>(0);
  const [isVisible, setIsVisible] = useState(false);
  const [alignment, setAlignment] = useState<{
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  }>({
    top: false,
    bottom: false,
    left: false,
    right: false,
  });

  const delay = useMemo(() => props.timeout ?? 200, [props.timeout]);

  const show = () => {
    window.clearTimeout(timeout.current);
    window.clearTimeout(hideTimeout.current);
    if (!props.truncated) {
      timeout.current = window.setTimeout(() => {
        setIsVisible(true);
      }, delay);
    } else {
      if (
        targetRef.current &&
        targetRef.current.scrollWidth > targetRef.current.offsetWidth
      ) {
        timeout.current = window.setTimeout(() => {
          setIsVisible(true);
        }, delay);
      }
    }
  };

  const hide = () => {
    clearTimeout(timeout.current);
    hideTimeout.current = window.setTimeout(
      () => setIsVisible(false),
      props.hideTimeout ?? 100
    );
  };

  useEffect(() => {
    if (isVisible) {
      const targetEl = targetRef.current;
      const popupEl = popupRef.current;

      if (targetEl && popupEl) {
        const targetRect = targetEl.getBoundingClientRect();
        const popupRect = popupEl.getBoundingClientRect();

        // for fixed position based on props
        if (props?.position) {
          if (props?.position === "top") {
            const fixedPosition = {
              top: targetRect.top - 12 - popupRect.height,
              left: Math.max(
                5,
                targetRect.left + targetRect.width / 2 - popupRect.width / 2 + 8
              ),
            };
            setAlignment({ ...alignment, bottom: false, top: true });
            setPosition(fixedPosition);
            setArrowPositionLeft(popupRect.width / 2 - 30);
            return;
          }

          if (props?.position === "bottom") {
            const fixedPosition = {
              top: targetRect.bottom + 6,
              left:
                targetRect.left + targetRect.width / 2 - popupRect.width / 2,
            };

            let arrowPositionLeft = popupRect.width / 2 - 30;

            if (
              fixedPosition.top + popupRect.height >
              window.innerHeight - 20
            ) {
              fixedPosition.top = targetRect.top - 12 - popupRect.height;
              arrowPositionLeft =
                targetRect.left +
                targetRect.width / 2 -
                fixedPosition.left -
                30;
            }

            if (fixedPosition.left + popupRect.width > window.innerWidth - 20) {
              fixedPosition.left = window.innerWidth - 20 - popupRect.width;
              arrowPositionLeft =
                targetRect.left +
                targetRect.width / 2 -
                fixedPosition.left -
                30;
            }

            setAlignment({ ...alignment, top: false, bottom: true });
            setPosition(fixedPosition);
            setArrowPositionTop(0);
            setArrowPositionLeft(arrowPositionLeft);
            return;
          }
        } else {
          // allow dynamic position for tooltip based on space available
          // right aligned tooltip
          const position = {
            top: targetRect.top + targetRect.height / 2 - popupRect.height / 2,
            left: targetRect.right + (props.hideArrow ? 4 : 10),
          };

          if (
            position.top < 5 ||
            position.top + popupRect.height > window.innerHeight - 5
          ) {
            position.top = Math.min(
              window.innerHeight - 5 - popupRect.height,
              Math.max(position.top, 5)
            );

            setArrowPositionTop(targetRect.top - position.top + 10);
          } else {
            setArrowPositionTop(popupRect.height / 2);
          }

          // left aligned tooltip
          if (position.left + popupRect.width < window.innerWidth) {
            setAlignment({ ...alignment, right: false, left: true });
          } else {
            setAlignment({ ...alignment, left: false, right: true });
            position.left =
              targetRect.left - (props.hideArrow ? 4 : 10) - popupRect.width;
          }

          setPosition(position);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, props.text, props.renderContent, props.hideArrow]);

  const renderedContent = useMemo(() => {
    return props?.renderContent ? props?.renderContent(props) : null;
  }, [props]);

  return (
    <div
      className={classNames(
        "Tooltip",
        {
          Visible: (props.text || props.renderContent) && isVisible,
        },
        props.parentClassName
      )}
      style={props.style}
      onMouseEnter={() => show()}
      onMouseLeave={() => hide()}
      onClick={props.onClick}
    >
      <div
        className={classNames("TooltipTarget", props.targetClassName)}
        ref={targetRef as React.RefObject<HTMLDivElement>}
        style={
          props.truncated
            ? { display: "block", ...(props.targetStyle ?? {}) }
            : props.targetStyle
        }
      >
        {props.children}
      </div>
      {createPortal(
        <div
          className={classNames(
            "Tooltip",
            {
              Visible: (props.text || props.renderContent) && isVisible,
            },
            props.parentClassName
          )}
          style={props.style}
          onMouseEnter={() => show()}
          onMouseLeave={() => hide()}
        >
          {(!!props.text || !!renderedContent) && !props.disabled && (
            <div
              className={classNames("TooltipPopup", props?.className, {
                Right: alignment.right,
                Left: alignment.left,
                Top: alignment.top,
                Bottom: alignment.bottom,
              })}
              ref={popupRef as React.RefObject<HTMLDivElement>}
              style={
                position
                  ? {
                      ...props.popupStyle,
                      top: position.top,
                      left: position.left,
                    }
                  : props.popupStyle
              }
            >
              {!props.hideArrow && (
                <div
                  className={classNames("TooltipArrow", props?.className, {
                    Right: alignment.right,
                    Left: alignment.left,
                    Top: alignment.top,
                    Bottom: alignment.bottom,
                  })}
                  style={{
                    top: arrowPositionTop,
                    left: arrowPositionLeft
                      ? 24 + arrowPositionLeft + "px"
                      : undefined,
                  }}
                />
              )}
              {props.text}
              {props.renderContent ? (
                <div className="TooltipPopupContent dark">
                  {props?.renderContent(props)}
                </div>
              ) : null}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default Tooltip;

export * from "./Tooltip.types";

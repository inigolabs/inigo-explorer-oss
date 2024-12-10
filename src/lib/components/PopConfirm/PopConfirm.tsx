import { useState, useRef, useMemo } from "react";
import Button, { ButtonVariant } from "../Buttons/Button";
import styles from "./PopConfirm.module.css";
import cn from "classnames";

export interface PopConfirm {
  icon?: React.ReactNode;
  title: string;
  text?: string;
  onConfirm: () => void;
  confirmText?: string;
  children: React.ReactNode;
}

export default function PopConfirm(props: PopConfirm) {
  const [isVisible, setIsVisible] = useState(false);

  const targetRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const popupLeft = useMemo(() => {
    if (targetRef.current && popupRef.current) {
      const targetRect = targetRef.current.getBoundingClientRect();
      const popupRect = popupRef.current.getBoundingClientRect();

      return targetRect.left + targetRect.width / 2 - popupRect.width / 2;
    }

    return 0;
  }, [targetRef.current, popupRef.current, isVisible]);

  const popupTop = useMemo(() => {
    if (targetRef.current && popupRef.current) {
      let result = 0;

      const targetRect = targetRef.current.getBoundingClientRect();
      const popupRect = popupRef.current.getBoundingClientRect();

      result = targetRect.top - popupRect.height - 8;

      if (result < 0) {
        result = targetRect.bottom + 8;
      }

      return result;
    }

    return 0;
  }, [targetRef.current, popupRef.current, isVisible]);

  return (
    <div className={cn(styles.popConfirm)} onClick={(e) => e.stopPropagation()}>
      <div
        className={cn(styles.popConfirmTarget)}
        ref={targetRef}
        onClick={() => setIsVisible(true)}
        onBlur={() => setTimeout(() => setIsVisible(false), 200)}
      >
        {props.children}
      </div>
      <div
        className={cn(styles.popConfirmPopup, isVisible && styles.visible)}
        ref={popupRef}
        style={{ left: popupLeft, top: popupTop }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn(styles.popConfirmTitle)}>
          {props.icon && (
            <div className={cn(styles.popConfirmIcon)}>{props.icon}</div>
          )}
          {props.title}
        </div>
        <div className={cn(styles.popConfirmText)}>{props.text}</div>
        <div className={cn(styles.popConfirmActions)}>
          <Button
            variant={ButtonVariant.Outline}
            onClick={() => {
              props.onConfirm();
              setIsVisible(false);
            }}
          >
            {props.confirmText ?? "Confirm"}
          </Button>
          <Button
            variant={ButtonVariant.Link}
            onClick={() => setIsVisible(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

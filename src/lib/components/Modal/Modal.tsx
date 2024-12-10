import "./Modal.scss";
import classNames from "classnames";
import {
  forwardRef,
  isValidElement,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import Icon, { Close } from "../Icon/Icon";
import Tooltip from "../Tooltip/Tooltip";
import Button, { ButtonVariant } from "../Buttons/Button";

type IContent = JSX.Element | JSX.Element[] | null;
export type IModalPropsButton = {
  label: string;
  handler: (close: () => void, data?: any) => void;
  tertiary?: boolean;
  tooltipInfo?: string;
  disabled?: boolean;
};

export interface IModalProps {
  className?: string;
  content?: IContent;
  initialVisible?: boolean;
  children?: React.ReactNode;
  fullWidthContent?: boolean;
  onClose?: () => void;
  options?: {
    title?: React.ReactNode;
    description?: string;
    closeButton?: boolean;
    buttons?: IModalPropsButton[];
    borderTopColor?: string;
    backgroundColor?: string;
  };
  fullContent?: boolean;
}

const Modal = forwardRef((props: IModalProps, ref) => {
  const [visible, setVisible] = useState(props.initialVisible ?? false);
  const [content, setContent] = useState<IContent>(null);
  const [data, setData] = useState<any>();
  const [buttonsPromise, setButtonsPromise] = useState<
    Record<string, Promise<any> | undefined>
  >({});

  const close = () => {
    setVisible(false);
    setTimeout(() => {
      setContent(null);
    }, 300);

    props.onClose?.();
  };

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
      }
    }

    window.addEventListener("keydown", onKeydown);

    return () => {
      window.removeEventListener("keydown", onKeydown);
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      close() {
        setVisible(false);
        setTimeout(() => {
          setContent(null);
        }, 300);
      },
      open(props: any) {
        if (props) {
          if (
            props.hasOwnProperty("content") &&
            isValidElement(props.content)
          ) {
            setContent(props.content);
          }
          if (props.hasOwnProperty("data")) {
            setData(props.data);
          }
        }
        setVisible(true);
      },
      isVisible: visible,
    }),
    [visible]
  );

  let contentToRender = content ?? props.children;

  return (
    <div
      className={classNames(
        "ModalWrapper",
        { Visible: visible, FullWidthContent: props.fullWidthContent },
        props.fullContent && "FullContent",
        props.className
      )}
    >
      <div className="BackGround" onClick={close}></div>
      <div
        className="Container"
        style={{
          backgroundColor: props.options?.backgroundColor,
          paddingTop: props.options?.closeButton === false ? 18 : undefined,
        }}
      >
        {!!props.options?.borderTopColor && (
          <div
            className="BorderTop"
            style={{ backgroundColor: props.options.borderTopColor }}
          />
        )}
        {props.options?.closeButton !== false && (
          <div
            className="Close"
            style={!!props.options?.borderTopColor ? { marginTop: 8 } : {}}
            onClick={() => close()}
          >
            <Icon size={16} icon={<Close />}></Icon>
          </div>
        )}
        {!!props.options?.title && (
          <div className="Title">
            {props.options.title}
            {!!props.options.description && (
              <div className="Description">{props.options.description}</div>
            )}
          </div>
        )}
        <div className="Body">
          <div className="ModelContent">{contentToRender ?? null}</div>

          {!!props.options?.buttons && (
            <div className="ButtonWrapper">
              {props.options?.buttons?.map((config) => {
                // const buttonNode = (
                //   <div
                //     tabIndex={config.disabled ? -1 : 0}
                //     key={config.label}
                //     className={classNames('Button', {
                //       Ternary: config?.tertiary,
                //       Disabled: !!buttonsPromise[config.label] || config?.disabled,
                //     })}
                //     onClick={() => {
                //       if (config.disabled) return;

                //       const result: any = config?.handler(close, data);

                //       if (result instanceof Promise) {
                //         setButtonsPromise({
                //           ...buttonsPromise,
                //           [config.label]: result,
                //         });

                //         result.then(() =>
                //           setButtonsPromise({
                //             ...buttonsPromise,
                //             [config.label]: undefined,
                //           }),
                //         );
                //       }
                //     }}
                //   >
                //     {config.label}
                //   </div>
                // );

                const buttonNode = (
                  <Button
                    key={config.label}
                    variant={
                      config.tertiary
                        ? ButtonVariant.Link
                        : ButtonVariant.Primary
                    }
                    disabled={
                      !!buttonsPromise[config.label] || config?.disabled
                    }
                    onClick={() => {
                      if (config.disabled) return;

                      const result: any = config?.handler(close, data);

                      if (result instanceof Promise) {
                        setButtonsPromise({
                          ...buttonsPromise,
                          [config.label]: result,
                        });

                        result.then(() =>
                          setButtonsPromise({
                            ...buttonsPromise,
                            [config.label]: undefined,
                          })
                        );
                      }
                    }}
                  >
                    {config.label}
                  </Button>
                );

                if (config.tooltipInfo) {
                  return (
                    <Tooltip key={config.label} text={config.tooltipInfo}>
                      {buttonNode}
                    </Tooltip>
                  );
                }

                return buttonNode;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default Modal;

import styles from "./Form.module.css";

import React, {
  createRef,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import classNames from "classnames";

import { FormControlRef, FormProps, FormRef, FormValue } from "./Form.types";

const Form: React.ForwardRefRenderFunction<FormRef, FormProps> = (
  props,
  ref
) => {
  const [value, setValue] = useState<FormValue>(props.defaultValue ?? {});
  const childrenRefs = useRef<Record<string, React.RefObject<FormControlRef>>>(
    {}
  );

  useImperativeHandle(ref, () => ({
    setValue: (value) => {
      Object.entries(childrenRefs.current).forEach(([name, childRef]) => {
        childRef.current?.setValue((value[name] as string) ?? "");

        setValue(value);
      });
    },
    focus: () => {
      childrenRefs.current[0]?.current?.focus?.();
    },
    getValue: () => {
      return value;
    },
    validate: () => {
      let validationResult: boolean[] = [];

      Object.values(childrenRefs.current).forEach((childRef) => {
        validationResult.push(childRef.current?.validate?.() ?? true);
      });

      return !validationResult.some((result) => !result);
    },
    setError: (error) => {
      Object.entries(childrenRefs.current).forEach(([name, childRef]) => {
        childRef.current?.setError?.(error[name]);
      });
    },
    clear: () => {
      setValue({});

      Object.values(childrenRefs.current).forEach((childRef) => {
        childRef.current?.clear();
      });
    },
  }));

  const onChildChange = (
    childName: string,
    childValue: unknown,
    type?: HTMLInputElement["type"]
  ) => {
    const newValue = {
      ...value,
      [childName]: childValue === "" ? undefined : childValue,
    };

    if (type === "number") {
      newValue[childName] = Number(newValue[childName]);
    }

    setValue(newValue);

    if (props.onChange) {
      props.onChange(newValue);
    }
  };

  const transformChildren = (children: FormProps["children"]) => {
    const refs: Record<string, React.RefObject<FormControlRef>> = {};

    const arr = Array.isArray(children) ? children : [children];

    const result = React.Children.map(arr, (child, i) => {
      if (React.isValidElement(child) && (child.props as any)?.name) {
        const { name: childName } = child.props as any;
        const ref = createRef<FormControlRef>();
        refs[childName] = ref;

        let isLastScalar = true;
        const nextChild = arr[i + 1];

        if (
          ["TextInput", "Select", "Checkbox"].includes(
            (nextChild as any)?.type?.displayName
          )
        ) {
          isLastScalar = false;
        }

        return React.cloneElement(child, {
          ref,
          className: classNames(
            (child.props as any).className,
            isLastScalar && "__last-scalar"
          ),
          onChange: (childValue: unknown) => {
            onChildChange(childName, childValue, (child.props as any).type);
          },
          defaultValue: props.defaultValue?.[childName],
          shouldRenderErrorMessages:
            props.shouldRenderErrorMessages ??
            (child.props as any).shouldRenderErrorMessages ??
            true,
        } as any);
      }
      return child;
    });

    childrenRefs.current = refs;

    return result;
  };

  return (
    <div
      className={classNames(styles.container, props.title && styles.hasTitle)}
      style={props.containerStyle}
    >
      {!!props.title && <div className={styles.title}>{props.title}</div>}
      <div
        className={classNames(styles.form, props.className)}
        style={props.style}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") {
            // ev.preventDefault();
            props.onSubmit?.(value, ev);
          }
        }}
      >
        {transformChildren(props.children)}
      </div>
    </div>
  );
};

export * from "./Form.types";
export default forwardRef(Form);

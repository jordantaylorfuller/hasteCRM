import React from "react";

export const Root = ({ children, value, onValueChange, ...props }: any) => {
  const contextValue = { value, onValueChange };
  return (
    <div {...props} data-testid="select-root">
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child, { ...contextValue } as any)
          : child,
      )}
    </div>
  );
};
export const Group = ({ children, ...props }: any) => (
  <div {...props}>{children}</div>
);
export const Value = ({ children, placeholder, value, ...props }: any) => {
  // Mock the value display logic
  const displayValue = value || children || placeholder;

  // Map common values to their display text
  const valueMap: Record<string, string> = {
    professional: "Professional",
    casual: "Casual",
    formal: "Formal",
    friendly: "Friendly",
    short: "Short",
    medium: "Medium",
    long: "Long",
  };

  const displayText = valueMap[displayValue as string] || displayValue;

  return <span {...props}>{displayText}</span>;
};
export const Trigger = React.forwardRef(
  ({ children, className, value, ...props }: any, ref: any) => (
    <button
      ref={ref}
      className={className}
      role="combobox"
      aria-controls="listbox"
      aria-expanded="false"
      {...props}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child) && child.type === Value
          ? React.cloneElement(child, { value } as any)
          : child,
      )}
    </button>
  ),
);
Trigger.displayName = "SelectTrigger";

export const Icon = ({ children, className, asChild, ...props }: any) => {
  // asChild is a Radix UI prop we ignore in mocks
  void asChild;
  const { ...cleanProps } = props;
  return (
    <span className={className} {...cleanProps}>
      {children}
    </span>
  );
};
export const Portal = ({ children, ...props }: any) => (
  <div {...props}>{children}</div>
);
export const Content = React.forwardRef(
  (
    {
      children,
      className,
      position = "popper",
      value,
      onValueChange,
      ...props
    }: any,
    ref: any,
  ) => {
    // Add the expected classes
    const combinedClassName =
      `relative z-50 bg-popover ${className || ""}`.trim();
    return (
      <div
        ref={ref}
        className={combinedClassName}
        data-position={position}
        {...props}
      >
        {React.Children.map(children, (child) =>
          React.isValidElement(child)
            ? React.cloneElement(child, { value, onValueChange } as any)
            : child,
        )}
      </div>
    );
  },
);
Content.displayName = "SelectContent";

export const Label = ({ children, className, ...props }: any) => (
  <div className={className} {...props}>
    {children}
  </div>
);
export const Item = React.forwardRef(
  ({ children, className, value, onValueChange, ...props }: any, ref: any) => {
    const handleClick = () => {
      if (onValueChange && value) {
        onValueChange(value);
      }
    };

    return (
      <div
        ref={ref}
        className={className}
        role="option"
        aria-selected="false"
        onClick={handleClick}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Item.displayName = "SelectItem";

export const ItemText = ({ children, ...props }: any) => (
  <span {...props}>{children}</span>
);
export const ItemIndicator = ({ children, className, ...props }: any) => (
  <span className={className} {...props}>
    {children}
  </span>
);
export const ScrollUpButton = ({ children, className, ...props }: any) => (
  <button className={className} {...props}>
    {children}
  </button>
);
export const ScrollDownButton = ({ children, className, ...props }: any) => (
  <button className={className} {...props}>
    {children}
  </button>
);
export const Separator = ({ className, ...props }: any) => (
  <div className={className} {...props} />
);
export const Viewport = ({ children, className, ...props }: any) => (
  <div className={className} role="listbox" {...props}>
    {children}
  </div>
);

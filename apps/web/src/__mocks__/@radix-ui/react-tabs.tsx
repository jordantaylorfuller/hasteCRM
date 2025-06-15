import React, { useState, useContext, createContext } from 'react';

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  dir?: 'ltr' | 'rtl';
}

const TabsContext = createContext<TabsContextValue | null>(null);

export const Root = React.forwardRef<
  HTMLDivElement,
  {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    orientation?: 'horizontal' | 'vertical';
    dir?: 'ltr' | 'rtl';
    children: React.ReactNode;
    className?: string;
    asChild?: boolean;
  }
>(({ defaultValue, value: controlledValue, onValueChange, orientation = 'horizontal', dir = 'ltr', children, className, asChild, ...props }, ref) => {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue || '');
  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;
  
  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(newValue);
    }
    onValueChange?.(newValue);
  };
  
  const Component = asChild ? React.Fragment : 'div';
  const componentProps = asChild ? {} : { ref, className, 'data-orientation': orientation, dir, ...props };
  
  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange, orientation, dir }}>
      {asChild ? children : <Component {...componentProps}>{children}</Component>}
    </TabsContext.Provider>
  );
});
Root.displayName = 'Tabs.Root';

export const List = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    className?: string;
    asChild?: boolean;
  }
>(({ children, className, asChild, ...props }, ref) => {
  const context = useContext(TabsContext);
  
  const Component = asChild ? React.Fragment : 'div';
  const componentProps = asChild ? {} : {
    ref,
    role: 'tablist',
    'aria-orientation': context?.orientation,
    'data-orientation': context?.orientation,
    className,
    tabIndex: 0,
    ...props
  };
  
  return asChild ? children : <Component {...componentProps}>{children}</Component>;
});
List.displayName = 'Tabs.List';

export const Trigger = React.forwardRef<
  HTMLButtonElement,
  {
    value: string;
    disabled?: boolean;
    children: React.ReactNode;
    className?: string;
    asChild?: boolean;
  }
>(({ value, disabled, children, className, asChild, ...props }, ref) => {
  const context = useContext(TabsContext);
  const isSelected = context?.value === value;
  
  const handleClick = () => {
    if (!disabled && context) {
      context.onValueChange(value);
    }
  };
  
  const Component = asChild ? React.Fragment : 'button';
  const componentProps = asChild ? {} : {
    ref,
    role: 'tab',
    'aria-selected': isSelected,
    'aria-controls': `radix-:r0:-content-${value}`,
    'data-state': isSelected ? 'active' : 'inactive',
    'data-disabled': disabled ? '' : undefined,
    disabled,
    tabIndex: isSelected ? 0 : -1,
    className,
    onClick: handleClick,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    ...props
  };
  
  return asChild ? children : <Component {...componentProps}>{children}</Component>;
});
Trigger.displayName = 'Tabs.Trigger';

export const Content = React.forwardRef<
  HTMLDivElement,
  {
    value: string;
    children: React.ReactNode;
    className?: string;
    forceMount?: boolean;
    asChild?: boolean;
  }
>(({ value, children, className, forceMount, asChild, ...props }, ref) => {
  const context = useContext(TabsContext);
  const isSelected = context?.value === value;
  
  if (!forceMount && !isSelected) {
    return null;
  }
  
  const Component = asChild ? React.Fragment : 'div';
  const componentProps = asChild ? {} : {
    ref,
    role: 'tabpanel',
    'aria-labelledby': `radix-:r0:-trigger-${value}`,
    'data-state': isSelected ? 'active' : 'inactive',
    'data-orientation': context?.orientation,
    tabIndex: 0,
    hidden: !isSelected,
    className,
    ...props
  };
  
  return asChild ? children : <Component {...componentProps}>{children}</Component>;
});
Content.displayName = 'Tabs.Content';
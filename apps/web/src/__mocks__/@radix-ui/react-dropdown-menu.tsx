import React, { useState, useContext, createContext } from 'react';

interface DropdownMenuContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

export const Root = ({ 
  open: controlledOpen, 
  onOpenChange,
  defaultOpen = false,
  children 
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  
  const handleOpenChange = (newOpen: boolean) => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };
  
  return (
    <DropdownMenuContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </DropdownMenuContext.Provider>
  );
};

export const Trigger = React.forwardRef<
  HTMLButtonElement,
  { children: React.ReactNode; asChild?: boolean; onClick?: (e: React.MouseEvent) => void; [key: string]: any }
>(({ children, asChild, onClick, ...props }, ref) => {
  const context = useContext(DropdownMenuContext);
  
  const handleClick = (e: React.MouseEvent) => {
    onClick?.(e);
    if (!e.defaultPrevented) {
      context?.onOpenChange(!context.open);
    }
  };
  
  if (asChild) {
    const child = React.Children.only(children) as React.ReactElement;
    return React.cloneElement(child, {
      ...child.props,
      onClick: (e: React.MouseEvent) => {
        handleClick(e);
        if (!e.defaultPrevented) {
          child.props.onClick?.(e);
        }
      },
      'aria-haspopup': 'menu',
      'aria-expanded': context?.open,
      'data-state': context?.open ? 'open' : 'closed',
    });
  }
  
  return (
    <button
      ref={ref}
      onClick={handleClick}
      aria-haspopup="menu"
      aria-expanded={context?.open}
      data-state={context?.open ? 'open' : 'closed'}
      {...props}
    >
      {children}
    </button>
  );
});
Trigger.displayName = 'DropdownMenu.Trigger';

export const Portal = ({ children }: { children: React.ReactNode }) => {
  const context = useContext(DropdownMenuContext);
  return context?.open ? <>{children}</> : null;
};

export const Content = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    className?: string;
    sideOffset?: number;
    align?: 'start' | 'center' | 'end';
    onEscapeKeyDown?: (e: KeyboardEvent) => void;
    onPointerDownOutside?: (e: PointerEvent) => void;
    [key: string]: any;
  }
>(({ children, className, sideOffset = 4, align = 'center', onEscapeKeyDown, ...props }, ref) => {
  const context = useContext(DropdownMenuContext);
  const contentRef = React.useRef<HTMLDivElement>(null);
  
  React.useImperativeHandle(ref, () => contentRef.current!);
  
  React.useEffect(() => {
    if (!context?.open) return;
    
    // Don't auto-focus - let the test handle initial focus
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscapeKeyDown?.(e);
        context.onOpenChange(false);
        return;
      }
      
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = Array.from(
          contentRef.current?.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"]), [role="menuitemcheckbox"]:not([aria-disabled="true"]), [role="menuitemradio"]:not([aria-disabled="true"])') || []
        ) as HTMLElement[];
        
        const currentIndex = items.findIndex(item => item === document.activeElement);
        let nextIndex: number;
        
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % items.length;
        } else {
          nextIndex = currentIndex === -1 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
        }
        
        items[nextIndex]?.focus();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [context?.open, onEscapeKeyDown]);
  
  if (!context?.open) return null;
  
  return (
    <div
      ref={contentRef}
      role="menu"
      aria-orientation="vertical"
      className={className}
      data-side="bottom"
      data-align={align}
      style={{ '--radix-dropdown-menu-content-transform-origin': 'var(--radix-popper-transform-origin)' } as any}
      {...props}
    >
      {children}
    </div>
  );
});
Content.displayName = 'DropdownMenu.Content';

export const Item = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
    onSelect?: (e: Event) => void;
    onClick?: (e: React.MouseEvent) => void;
    textValue?: string;
    [key: string]: any;
  }
>(({ children, className, disabled, onSelect, onClick, textValue, ...props }, ref) => {
  const context = useContext(DropdownMenuContext);
  
  const handleClick = (e: React.MouseEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    
    // Call onClick if provided
    onClick?.(e);
    
    const selectEvent = e as any;
    let defaultPrevented = false;
    selectEvent.preventDefault = () => { defaultPrevented = true; };
    selectEvent.defaultPrevented = false;
    Object.defineProperty(selectEvent, 'defaultPrevented', {
      get: () => defaultPrevented
    });
    
    onSelect?.(selectEvent);
    
    // Only close menu if default wasn't prevented
    if (!defaultPrevented) {
      context?.onOpenChange(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e as any);
    }
  };
  
  // Apply disabled styles directly since the component uses data attribute selectors
  const finalClassName = disabled 
    ? `${className || ''} pointer-events-none opacity-50`.trim()
    : className;
  
  return (
    <div
      ref={ref}
      role="menuitem"
      className={finalClassName}
      aria-disabled={disabled}
      data-disabled={disabled ? '' : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      {...props}
    >
      {children}
    </div>
  );
});
Item.displayName = 'DropdownMenu.Item';

// Create a context for checkbox items to share their checked state
const CheckboxItemContext = createContext<{ checked?: boolean }>({});

export const CheckboxItem = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    className?: string;
    disabled?: boolean;
    [key: string]: any;
  }
>(({ children, checked, onCheckedChange, className, disabled, ...props }, ref) => {
  const handleSelect = (e: Event) => {
    e.preventDefault(); // Prevent menu from closing
    onCheckedChange?.(!checked);
  };
  
  return (
    <CheckboxItemContext.Provider value={{ checked }}>
      <Item
        ref={ref}
        role="menuitemcheckbox"
        aria-checked={checked}
        onSelect={handleSelect}
        className={className}
        disabled={disabled}
        {...props}
      >
        {children}
      </Item>
    </CheckboxItemContext.Provider>
  );
});
CheckboxItem.displayName = 'DropdownMenu.CheckboxItem';

export const RadioGroup = ({ 
  children, 
  value,
  onValueChange 
}: { 
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
}) => {
  return (
    <div role="group">
      {React.Children.map(children, child => {
        if (React.isValidElement(child) && (child.type === RadioItem || (child.type as any)?.displayName === 'DropdownMenu.RadioItem')) {
          const isChecked = child.props.value === value;
          return React.cloneElement(child, {
            ...child.props,
            checked: isChecked,
            onSelect: () => onValueChange?.(child.props.value)
          } as any);
        }
        return child;
      })}
    </div>
  );
};

// Create a context for radio items to share their checked state
const RadioItemContext = createContext<{ checked?: boolean }>({});

export const RadioItem = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    value: string;
    className?: string;
    disabled?: boolean;
    checked?: boolean;
    onSelect?: () => void;
    [key: string]: any;
  }
>(({ children, value, className, disabled, checked, onSelect, ...props }, ref) => {
  const context = useContext(DropdownMenuContext);
  
  const handleSelect = (e: Event) => {
    e.preventDefault(); // Prevent menu from closing
    onSelect?.();
  };
  
  return (
    <RadioItemContext.Provider value={{ checked }}>
      <Item
        ref={ref}
        role="menuitemradio"
        aria-checked={checked}
        className={className}
        disabled={disabled}
        onSelect={handleSelect}
        {...props}
      >
        {children}
      </Item>
    </RadioItemContext.Provider>
  );
});
RadioItem.displayName = 'DropdownMenu.RadioItem';

export const ItemIndicator = ({ children }: { children: React.ReactNode }) => {
  const checkboxContext = useContext(CheckboxItemContext);
  const radioContext = useContext(RadioItemContext);
  
  // Only render children if the parent item is checked
  const isChecked = checkboxContext?.checked || radioContext?.checked;
  
  return isChecked ? <>{children}</> : null;
};

export const Label = React.forwardRef<
  HTMLDivElement,
  { children: React.ReactNode; className?: string; [key: string]: any }
>(({ children, className, ...props }, ref) => {
  return <div ref={ref} className={className} aria-hidden="true" {...props}>{children}</div>;
});
Label.displayName = 'DropdownMenu.Label';

export const Separator = React.forwardRef<
  HTMLDivElement,
  { className?: string; [key: string]: any }
>(({ className, ...props }, ref) => {
  return <div ref={ref} role="separator" className={className} aria-orientation="horizontal" {...props} />;
});
Separator.displayName = 'DropdownMenu.Separator';

export const Shortcut = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <span className={className} aria-hidden="true">{children}</span>;
};

export const Group = ({ children }: { children: React.ReactNode }) => {
  return <div role="group">{children}</div>;
};

export const Sub = ({ children, open, onOpenChange }: { 
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open !== undefined ? open : uncontrolledOpen;
  
  const handleOpenChange = (newOpen: boolean) => {
    if (open === undefined) {
      setUncontrolledOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };
  
  return (
    <DropdownMenuContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DropdownMenuContext.Provider>
  );
};

export const SubTrigger = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    className?: string;
    [key: string]: any;
  }
>(({ children, className, ...props }, ref) => {
  const context = useContext(DropdownMenuContext);
  
  const handlePointerEnter = () => {
    context?.onOpenChange(true);
  };
  
  const handlePointerLeave = () => {
    // Keep submenu open when moving to it
  };
  
  return (
    <div
      ref={ref}
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={context?.open}
      data-state={context?.open ? 'open' : 'closed'}
      className={className}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      {...props}
    >
      {children}
    </div>
  );
});
SubTrigger.displayName = 'DropdownMenu.SubTrigger';

export const SubContent = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    className?: string;
    [key: string]: any;
  }
>(({ children, className, ...props }, ref) => {
  const context = useContext(DropdownMenuContext);
  
  if (!context?.open) return null;
  
  return (
    <div
      ref={ref}
      role="menu"
      aria-orientation="vertical"
      className={className}
      {...props}
    >
      {children}
    </div>
  );
});
SubContent.displayName = 'DropdownMenu.SubContent';
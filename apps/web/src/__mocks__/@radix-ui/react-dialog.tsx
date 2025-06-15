import React from 'react';
import ReactDOM from 'react-dom';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export const Root = ({ open, onOpenChange, children }: DialogProps) => {
  return <>{open && children}</>;
};

export const Trigger = ({ children, asChild, ...props }: any) => {
  const Component = asChild ? React.Fragment : 'button';
  return asChild ? children : <Component {...props}>{children}</Component>;
};

export const Portal = ({ children }: { children: React.ReactNode }) => {
  // Instead of creating a portal, just render inline for testing
  return <>{children}</>;
};

export const Overlay = ({ className, forceMount, ...props }: any) => {
  // forceMount is a Radix UI prop we can ignore in tests
  return <div className={className} data-testid="dialog-overlay" {...props} />;
};

export const Content = React.forwardRef<HTMLDivElement, any>(
  ({ children, className, onEscapeKeyDown, onPointerDownOutside, onInteractOutside, ...props }, ref) => {
    React.useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && onEscapeKeyDown) {
          onEscapeKeyDown(e);
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [onEscapeKeyDown]);
    
    return (
      <div ref={ref} className={className} role="dialog" aria-modal="true" {...props}>
        {children}
      </div>
    );
  }
);
Content.displayName = 'Dialog.Content';

export const Header = ({ children, className, ...props }: any) => {
  return <div className={className} {...props}>{children}</div>;
};

export const Title = ({ children, className, ...props }: any) => {
  return <h2 className={className} {...props}>{children}</h2>;
};

export const Description = ({ children, className, ...props }: any) => {
  return <p className={className} {...props}>{children}</p>;
};

export const Close = ({ children, asChild, onClick, ...props }: any) => {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) onClick(e);
    // Trigger onOpenChange(false) if available through context
  };
  
  const Component = asChild ? React.Fragment : 'button';
  const componentProps = asChild ? {} : { ...props, onClick: handleClick, type: 'button' };
  
  return asChild ? children : <Component {...componentProps}>{children}</Component>;
};
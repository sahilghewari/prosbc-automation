import React from 'react';

const buttonVariants = {
  default: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
  destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-blue-500',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
  ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
  link: 'text-blue-600 underline-offset-4 hover:underline focus:ring-blue-500'
};

const buttonSizes = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3',
  lg: 'h-11 rounded-md px-8',
  icon: 'h-10 w-10'
};

const Button = React.forwardRef(({ 
  className = '', 
  variant = 'default', 
  size = 'default',
  disabled = false,
  ...props 
}, ref) => {
  return (
    <button
      ref={ref}
      className={`
        inline-flex items-center justify-center rounded-md text-sm font-medium 
        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 
        disabled:opacity-50 disabled:pointer-events-none
        ${buttonVariants[variant]} 
        ${buttonSizes[size]} 
        ${className}
      `}
      disabled={disabled}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export { Button, buttonVariants };

import React, { useState, useEffect } from 'react';
import { formatToBRL, parseBRLToFloat } from '../utils/currency';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (val: number) => void;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  onFocus,
  onBlur,
  className = '',
  disabled = false,
  required = false,
  placeholder = 'R$ 0,00',
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState('');

  // Synchronize with external value changes when not editing
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value > 0 ? formatToBRL(value) : '');
    }
  }, [value, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (value > 0) {
      // Display with comma as decimal for natural typing, e.g. "2500,50" instead of "R$ 2.500,50"
      setLocalValue(value.toString().replace('.', ','));
    } else {
      setLocalValue('');
    }
    if (onFocus) {
      onFocus(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputVal = e.target.value;
    
    // Normalize dots to commas as decimal separator
    inputVal = inputVal.replace(/\./g, ',');
    
    // Clean string: keep only digits and a single comma
    const cleanChars: string[] = [];
    let commaCount = 0;
    
    for (let i = 0; i < inputVal.length; i++) {
      const char = inputVal[i];
      if (/[0-9]/.test(char)) {
        cleanChars.push(char);
      } else if (char === ',' && commaCount === 0) {
        cleanChars.push(char);
        commaCount++;
      }
    }
    
    const sanitizedVal = cleanChars.join('');
    setLocalValue(sanitizedVal);

    // Propagate numeric value to parent on each keystroke
    const numericValue = parseBRLToFloat(sanitizedVal);
    onChange(numericValue);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    const numericValue = parseBRLToFloat(localValue);
    setLocalValue(numericValue > 0 ? formatToBRL(numericValue) : '');
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      className={className}
      {...rest}
    />
  );
};

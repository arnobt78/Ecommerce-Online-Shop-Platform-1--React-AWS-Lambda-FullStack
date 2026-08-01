/**
 * RippleButton — reusable Material-style click ripple, per docs/RIPPLE_BUTTON_EFFECT.md.
 * Purely visual: ripple is `pointer-events: none` and never changes button
 * semantics, so it's a safe drop-in replacement for a plain <button>.
 */

import { useState, useCallback, type ButtonHTMLAttributes, type MouseEvent } from "react";

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

interface RippleButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
}

export function RippleButton({
  children,
  className = "",
  onClick,
  type = "button",
  disabled = false,
  ...props
}: RippleButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const addRipple = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = event.clientX - rect.left - size / 2;
      const y = event.clientY - rect.top - size / 2;
      const id = Date.now();

      setRipples((prev) => [...prev, { id, x, y, size }]);
      // Remove after the CSS animation duration (600ms) so the DOM doesn't grow unbounded.
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 600);

      onClick?.(event);
    },
    [disabled, onClick],
  );

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={addRipple}
      className={`relative overflow-hidden ${className}`}
      {...props}
    >
      {children}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-white/40 pointer-events-none animate-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
        />
      ))}
    </button>
  );
}

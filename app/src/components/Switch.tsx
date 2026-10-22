import { useId } from 'react';
import type { ReactNode } from 'react';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  /** ラベルの下に出す補足 */
  description?: string | undefined;
};

/** ON/OFF の切り替え。行全体をタップ領域にする */
export function Switch({ checked, onChange, children, description }: Props) {
  const id = useId();
  return (
    <label className="switch">
      <span className="switch__text">
        <span className="switch__label" id={`${id}-label`}>
          {children}
        </span>
        {description !== undefined && (
          <span className="switch__description" id={`${id}-description`}>
            {description}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch__input"
        checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description === undefined ? undefined : `${id}-description`}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

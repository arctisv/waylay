import { Icon, type IconProps } from '../Icon';

export function PenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4.5 19.5 1-4.5L15.6 4.9a2.1 2.1 0 0 1 3 3L8.5 18l-4 1.5Z" />
      <path d="m13.5 7 3.5 3.5" />
    </Icon>
  );
}

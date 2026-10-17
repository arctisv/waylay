import { Icon, type IconProps } from '../Icon';

export function ChipIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" />
      <rect x="10" y="10" width="4" height="4" rx="1" />
      <path d="M10 3.5v3M14 3.5v3M10 17.5v3M14 17.5v3M3.5 10h3M3.5 14h3M17.5 10h3M17.5 14h3" />
    </Icon>
  );
}

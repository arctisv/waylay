import { Icon, type IconProps } from '../Icon';

export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5" />
      <path d="M4 4v4.5h4.5" />
      <path d="M4 12.5a8 8 0 0 0 13.7 5.2l2.3-2.2" />
      <path d="M20 20v-4.5h-4.5" />
    </Icon>
  );
}

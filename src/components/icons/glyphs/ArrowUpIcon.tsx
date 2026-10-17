import { Icon, type IconProps } from '../Icon';

export function ArrowUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 19V5" />
      <path d="M6.5 10.5 12 5l5.5 5.5" />
    </Icon>
  );
}

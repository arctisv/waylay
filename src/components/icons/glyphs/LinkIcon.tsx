import { Icon, type IconProps } from '../Icon';

export function LinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 13.5a4 4 0 0 0 5.66.34l2.5-2.5a4 4 0 0 0-5.66-5.66l-1.25 1.25" />
      <path d="M14 10.5a4 4 0 0 0-5.66-.34l-2.5 2.5a4 4 0 0 0 5.66 5.66l1.25-1.25" />
    </Icon>
  );
}

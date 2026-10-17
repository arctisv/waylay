import { Icon, type IconProps } from '../Icon';

export function DocumentIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M9 12.5h6M9 16h4" />
    </Icon>
  );
}

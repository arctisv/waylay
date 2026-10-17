import { Icon, type IconProps } from '../Icon';

export function QuestionIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.75 9.6a2.35 2.35 0 0 1 4.5.9c0 1.5-2.25 1.9-2.25 3.3" />
      <path d="M12 16.75h.01" />
    </Icon>
  );
}

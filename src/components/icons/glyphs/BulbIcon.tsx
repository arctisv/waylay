import { Icon, type IconProps } from '../Icon';

export function BulbIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 17.5h5" />
      <path d="M10.5 20.5h3" />
      <path d="M12 3.5a5.75 5.75 0 0 0-3.4 10.4c.6.45.9 1.05.9 1.75v.35h5v-.35c0-.7.3-1.3.9-1.75A5.75 5.75 0 0 0 12 3.5Z" />
    </Icon>
  );
}

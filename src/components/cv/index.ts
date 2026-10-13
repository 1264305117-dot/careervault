/**
 * 设计系统原语统一出口。
 *
 * 业务代码一律从 '@/components/cv' 引入，不要深入具体文件路径，
 * 这样后续替换实现时不会波及调用方。
 */
export { Button, buttonVariants, type ButtonProps } from './Button';
export {
  Card,
  ClayPanel,
  cardVariants,
  type CardProps,
  type ClayPanelTone,
} from './Card';
export {
  FieldLabel,
  Input,
  SectionTitle,
  Select,
  Textarea,
  inputVariants,
  textareaClass,
  type InputProps,
  type SelectProps,
} from './Field';
export {
  Chip,
  EngineBadge,
  SectionLabel,
  StatusDot,
  TagList,
  TypeBadge,
  TYPE_META,
} from './Badge';
export { TaskAccordion, TaskEditor, TaskList } from './Task';
export { VaultSwitcher, type VaultSwitcherProps } from './Vault';
export { PhotoField, resizeImageFile, type PhotoFieldProps } from './Photo';
export { TemplatePicker, type TemplatePickerProps } from './TemplatePicker';
export { UndoBar, type UndoBarProps } from './UndoBar';
export { IconTile, type IconTileProps } from './IconTile';
export { Orb, type OrbProps, type OrbTone } from './Orb';
export { Reveal } from './Reveal';
export { EmptyState } from './EmptyState';
export { PageHeader } from './PageHeader';

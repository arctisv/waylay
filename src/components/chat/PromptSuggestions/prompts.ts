import type { ComponentType } from 'react';
import { BulbIcon, DocumentIcon, PenIcon, QuestionIcon, type IconProps } from '@/components/icons';

export interface Prompt {
  id: string;
  text: string;
  Icon: ComponentType<IconProps>;
}

export const prompts: Prompt[] = [
  { id: 'rewrite', text: 'Rewrite a message so it sounds friendlier', Icon: PenIcon },
  { id: 'summarise', text: 'Summarise a long text in five bullet points', Icon: DocumentIcon },
  { id: 'brainstorm', text: 'Brainstorm names for a small coffee shop', Icon: BulbIcon },
  { id: 'explain', text: 'Explain how WebGPU works in simple terms', Icon: QuestionIcon },
];

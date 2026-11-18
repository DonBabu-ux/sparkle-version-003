import { lazy, Suspense } from 'react';
import type { FC } from 'react';

// emoji-mart ships ~1MB of emoji data; only load it when a picker is open.
const LazyPicker = lazy(async () => {
  const [picker, data] = await Promise.all([
    import('@emoji-mart/react'),
    import('@emoji-mart/data'),
  ]) as [{ default: React.ComponentType<any> }, { default: unknown }];
  const Picker = picker.default;
  return {
    default: (props: Record<string, unknown>) => <Picker {...props} data={data.default} />,
  };
});

interface LazyEmojiPickerProps {
  onEmojiSelect: (emoji: { native: string }) => void;
  theme?: 'light' | 'dark' | 'auto';
}

export const LazyEmojiPicker: FC<LazyEmojiPickerProps> = ({ onEmojiSelect, theme = 'auto' }) => (
  <Suspense fallback={<div className="h-[30vh] w-full" />}>
    <LazyPicker
      onEmojiSelect={onEmojiSelect}
      theme={theme}
      native
      previewPosition="none"
      skinTonePosition="none"
      navPosition="none"
      searchPosition="none"
      perLine={10}
      width="100%"
    />
  </Suspense>
);

export default LazyEmojiPicker;
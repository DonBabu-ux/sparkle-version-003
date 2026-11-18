import { lazy, Suspense } from 'react';
import type { FC } from 'react';

// emoji-mart ships ~1MB of emoji data. Loading it through this module keeps it
// out of every route's initial chunk: the data is fetched only when a
// <Picker> actually renders. `data` is accepted for call-site compatibility
// and bound internally.
const LazyEmojiMart = lazy(async () => {
  const [picker, data] = await Promise.all([
    import('@emoji-mart/react'),
    import('@emoji-mart/data'),
  ]) as [{ default: FC<Record<string, unknown>> }, { default: unknown }];
  const EmojiPicker = picker.default;
  return {
    default: (props: Record<string, unknown>) => <EmojiPicker {...props} data={data.default} />,
  };
});

export const data = null;

export const Picker: FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={null}>
    <LazyEmojiMart {...props} />
  </Suspense>
);

export default Picker;
import { ReactNode } from 'react';
import { motion } from 'framer-motion';

type AnalyticsCardProps = {
  icon: ReactNode;
  title: string;
  count: number | string;
};

export const AnalyticsCard = ({ icon, title, count }: AnalyticsCardProps) => {
  return (
    <motion.div
      className="glass bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-6 flex flex-col items-center text-center"
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 200 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
    >
      <div className="text-pink-400 mb-3">{icon}</div>
      <h3 className="text-lg font-medium text-pink-200 mb-1">{title}</h3>
      <p className="text-2xl font-bold text-pink-100">{count}</p>
    </motion.div>
  );
};

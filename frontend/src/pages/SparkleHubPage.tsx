import 'react';
import { useNavigate } from 'react-router-dom';
import SparkleHub from '../components/SparkleHub';

export default function SparkleHubPage() {
  const navigate = useNavigate();

  return (
    <SparkleHub 
      onClose={() => {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate('/dashboard');
        }
      }} 
    />
  );
}

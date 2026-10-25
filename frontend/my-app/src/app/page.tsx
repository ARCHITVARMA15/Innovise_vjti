import CustomCursor from './components/CustomCursor';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import TickerTape from './components/TickerTape';
import FeaturesSection from './components/FeaturesSection';
import DemoSection from './components/DemoSection';
import StatsSection from './components/StatsSection';
import OrbitSection from './components/OrbitSection';
import Footer from './components/Footer';

export default function Home() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <HeroSection />
      <TickerTape />
      <FeaturesSection />
      <DemoSection />
      <StatsSection />
      <OrbitSection />
      <Footer />
    </>
  );
}

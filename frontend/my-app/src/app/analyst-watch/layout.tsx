import type {Metadata} from 'next';
import Sidebar from '../overview/components/Sidebar';
import SharedTopNav from '../components/SharedTopNav';
import './watch.css';
export const metadata:Metadata={title:'Analyst Watch | Veritas',description:'Simulated financial updates with a durable alert and real WhatsApp notification workflow'};
export default function WatchLayout({children}:{children:React.ReactNode}) {
  return <div className="overview-root aw-shell"><Sidebar/><div className="aw-main"><SharedTopNav showDemoNotifications={false}/><main className="aw-content"><div className="aw-disclosure">SIMULATED FINANCIAL DATA <span>/</span> REAL NOTIFICATION DELIVERY <small>Local presentation demo · no live financial-data feed</small></div>{children}</main></div></div>;
}

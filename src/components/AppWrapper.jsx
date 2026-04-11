import './AppWrapper.css';
import { useGlobal } from '../context/GlobalContext';
import Overview from './views/Overview';
import Unit from './views/Unit';
import { useEffect } from 'react';
import Header from './header/Header';


export default function AppWrapper() {

  const {view, setView} = useGlobal();

  useEffect(() => {
    setView({
      page: 'overview',
      params: {},
    })
  }, []);

  return (


    <>
      <div className="canvAssist">
        
        <Header />

        { view.page === 'overview' ? <Overview /> : null}

        { view.page === 'unit' ? <Unit {...view.params} /> : null}

      </div>
    
    </>

    
  );
}
